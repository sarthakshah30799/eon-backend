import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { PartyProfile, ClientType } from "./party-profile.entity";
import { PartyProfileStatusChangeLog } from "./party-profile-status-change-log.entity";
import { Branch } from "../branches/branch.entity";
import { State } from "../state/state.entity";
import { User } from "../users/user.entity";
import { CreatePartyProfileDto } from "./dto/create-party-profile.dto";
import { UpdatePartyProfileDto } from "./dto/update-party-profile.dto";
import { ReviewPartyProfileDto } from "./dto/review-party-profile.dto";
import { PartyProfileResponseDto } from "./dto/party-profile-response.dto";
import { PartyProfileListQueryDto } from "./dto/party-profile-list-query.dto";
import { PartyProfileListResponseDto } from "./dto/party-profile-list-response.dto";
import { WorkflowStatus } from "../common/enums/workflow-status.enum";

type PartyProfileAction = "view" | "add" | "modify" | "delete";

function normalizeDto(dto: CreatePartyProfileDto | UpdatePartyProfileDto) {
  const normalizeOptional = (value?: string | null) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };

  return {
    ...dto,
    code: dto.code?.trim().toUpperCase(),
    name: dto.name?.trim(),
    address1: dto.address1?.trim(),
    address2: dto.address2?.trim(),
    address3: dto.address3?.trim(),
    city: dto.city?.trim(),
    pinCode: dto.pinCode?.trim(),
    email: dto.email?.trim() || null,
    location: normalizeOptional(dto.location),
    kycRiskCategory: normalizeOptional(dto.kycRiskCategory),
    defaultAgent: normalizeOptional(dto.defaultAgent),
    group: normalizeOptional(dto.group),
    entityType: normalizeOptional(dto.entityType),
    marketingExecutive: normalizeOptional(dto.marketingExecutive),
    businessNature: normalizeOptional(dto.businessNature),
    tdsGroup: normalizeOptional(dto.tdsGroup),
  };
}

function pickDefinedFields<T extends Record<string, any>>(value: T): Partial<T> {
  const entries = Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined);
  return Object.fromEntries(entries) as Partial<T>;
}

@Injectable()
export class PartyProfileService {
  constructor(
    @InjectRepository(PartyProfile)
    private readonly partyProfileRepository: Repository<PartyProfile>,
    @InjectRepository(PartyProfileStatusChangeLog)
    private readonly partyProfileStatusChangeLogRepository: Repository<PartyProfileStatusChangeLog>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(State)
    private readonly stateRepository: Repository<State>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private async getCurrentUser(userId: string) {
    return this.userRepository.findOne({
      where: { id: userId },
      relations: [
        "userRoles",
        "userRoles.role",
        "userRoles.role.menuPermissions",
        "userRoles.role.menuPermissions.menu",
        "userRoles.role.menuPermissions.permission",
        "userRoles.branch",
      ],
    });
  }

  private normalizePartyProfilePath(type?: string) {
    if (!type) {
      return "";
    }    

    return `/party-profiles/${type.trim().toLowerCase().replace(/_/g, "-")}`;
  }

  private canAccessPartyProfileType(
    user: User | null | undefined,
    type: string,
    action: PartyProfileAction = "view",
  ) {
    if (!user) {
      return false;
    }

    if (user.isAdmin) {
      return true;
    }

    if (this.isReviewer(user)) {
      return true;
    }

    const requiredPath = this.normalizePartyProfilePath(type);
    if (!requiredPath) {
      return false;
    }

    return (
      user.userRoles?.some(userRole =>
        userRole.role?.menuPermissions?.some(menuPermission => {
          const permissionCode = menuPermission.permission?.code;
          const menuPath = menuPermission.menu?.path?.trim().toLowerCase();

          if (!menuPath || permissionCode !== action) {
            return false;
          }

          return (
            menuPath === requiredPath ||
            requiredPath.startsWith(`${menuPath}/`)
          );
        }),
      ) ?? false
    );
  }

  private assertPartyProfileAccess(
    user: User | null | undefined,
    type: string,
    action: PartyProfileAction = "view",
  ) {
    if (!this.canAccessPartyProfileType(user, type, action)) {
      throw new NotFoundException(`Party profile type ${type} not found`);
    }
  }

  private isReviewer(user: User | null | undefined) {
    if (!user) {
      return false;
    }

    if (user.isAdmin) {
      return true;
    }

    return user.userRoles?.some(userRole => userRole.role?.isHoStaff) || false;
  }

  private getReviewerBranchIds(user: User | null | undefined) {
    if (!user?.userRoles?.length) {
      return [];
    }

    return [
      ...new Set(
        user.userRoles
          .map(userRole => userRole.branch?.id)
          .filter((branchId): branchId is string => Boolean(branchId)),
      ),
    ];
  }

  getTypes(userId?: string) {
    const allTypes = [
      { value: ClientType.CORPORATE_CLIENT, label: 'CORPORATE CLIENT' },
      { value: ClientType.FFMC, label: 'FFMC' },
      { value: ClientType.RF, label: 'RF' },
      { value: ClientType.AUTHORISED_DEALER, label: 'AUTHORISED DEALER' },
      { value: ClientType.RMC, label: 'RMC' },
      { value: ClientType.FRANCHISE, label: 'FRANCHISE' },
      { value: ClientType.AGENT, label: 'AGENT' },
      { value: ClientType.FOREIGN_CORRESPONDENT, label: 'FOREIGN CORRESPONDENT' },
      { value: ClientType.FOREX_CORRESPONDENT, label: 'FOREX CORRESPONDENT' },
      { value: ClientType.MARKETING_EXECUTIVE, label: 'MARKETING EXECUTIVE' },
      { value: ClientType.CARD_ISSUER_PROFILE, label: 'CARD ISSUER PROFILE' },
      { value: ClientType.MISC_PROFILE, label: 'MISC SUPPLIER PROFILE' }
    ];

    if (!userId) {
      return [];
    }

    return this.getCurrentUser(userId).then(user => {
      if (!user) {
        return [];
      }

      if (user.isAdmin || this.isReviewer(user)) {
        return allTypes;
      }

      return allTypes.filter(type =>
        this.canAccessPartyProfileType(user, type.value, "view"),
      );
    });
  }

  async create(dto: CreatePartyProfileDto, userId: string): Promise<PartyProfileResponseDto> {
    const user = await this.getCurrentUser(userId);
    const normalized = normalizeDto(dto);
    this.assertPartyProfileAccess(user, normalized.type ?? dto.type ?? ClientType.CORPORATE_CLIENT, "add");

    const existingCode = await this.partyProfileRepository.findOne({
      where: { code: normalized.code },
    });
    if (existingCode) {
      throw new ConflictException(`Party Profile Code "${normalized.code}" already exists`);
    }

    const existingName = await this.partyProfileRepository.findOne({
      where: { name: normalized.name },
    });
    if (existingName) {
      throw new ConflictException(`Party Profile Name "${normalized.name}" already exists`);
    }

    if (dto.originBranchId) {
      const branch = await this.branchRepository.findOne({ where: { id: dto.originBranchId } });
      if (!branch) {
        throw new NotFoundException(`Origin Branch with id ${dto.originBranchId} not found`);
      }
    }

    if (dto.gstStateId) {
      const state = await this.stateRepository.findOne({ where: { id: dto.gstStateId } });
      if (!state) {
        throw new NotFoundException(`GST State with id ${dto.gstStateId} not found`);
      }
    }

    if (dto.stateId) {
      const state = await this.stateRepository.findOne({ where: { id: dto.stateId } });
      if (!state) {
        throw new NotFoundException(`State with id ${dto.stateId} not found`);
      }
    }

    const {
      location,
      kycRiskCategory,
      defaultAgent,
      group,
      entityType,
      marketingExecutive,
      businessNature,
      tdsGroup,
      ...rest
    } = normalized;

    const client = this.partyProfileRepository.create({
      ...rest,
      location: location ? ({ id: location } as any) : null,
      kycRiskCategory: kycRiskCategory ? ({ id: kycRiskCategory } as any) : null,
      defaultAgent: defaultAgent ? ({ id: defaultAgent } as any) : null,
      group: group ? ({ id: group } as any) : null,
      entityType: entityType ? ({ id: entityType } as any) : null,
      marketingExecutive: marketingExecutive ? ({ id: marketingExecutive } as any) : null,
      businessNature: businessNature ? ({ id: businessNature } as any) : null,
      tdsGroup: tdsGroup ? ({ id: tdsGroup } as any) : null,
      dateOfIntro: normalized.dateOfIntro ? new Date(normalized.dateOfIntro) : new Date(),
      blockDateFrom: normalized.blockDateFrom ? new Date(normalized.blockDateFrom) : null,
      establishmentDate: normalized.establishmentDate ? new Date(normalized.establishmentDate) : null,
      panDob: normalized.panDob ? new Date(normalized.panDob) : null,
      ffmcRegDate: normalized.ffmcRegDate ? new Date(normalized.ffmcRegDate) : null,
      createdBy: userId,
      updatedBy: userId,
      status: WorkflowStatus.PENDING,
      statusUpdatedById: null,
      statusUpdatedAt: null,
    });

    const saved = await this.partyProfileRepository.save(client);
    return this.findById(saved.id);
  }

  async update(id: string, dto: UpdatePartyProfileDto, userId: string): Promise<PartyProfileResponseDto> {
    const user = await this.getCurrentUser(userId);
    const client = await this.partyProfileRepository.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException(`Party Profile with id ${id} not found`);
    }

    const normalized = normalizeDto(dto);
    this.assertPartyProfileAccess(user, normalized.type ?? client.type, "modify");

    if (normalized.name && normalized.name !== client.name) {
      const existingName = await this.partyProfileRepository.findOne({
        where: { name: normalized.name },
      });
      if (existingName) {
        throw new ConflictException(`Party Profile Name "${normalized.name}" already exists`);
      }
    }

    if (dto.originBranchId && dto.originBranchId !== client.originBranchId) {
      const branch = await this.branchRepository.findOne({ where: { id: dto.originBranchId } });
      if (!branch) {
        throw new NotFoundException(`Origin Branch with id ${dto.originBranchId} not found`);
      }
    }

    if (dto.gstStateId && dto.gstStateId !== client.gstStateId) {
      const state = await this.stateRepository.findOne({ where: { id: dto.gstStateId } });
      if (!state) {
        throw new NotFoundException(`GST State with id ${dto.gstStateId} not found`);
      }
    }

    if (dto.stateId && dto.stateId !== client.stateId) {
      const state = await this.stateRepository.findOne({ where: { id: dto.stateId } });
      if (!state) {
        throw new NotFoundException(`State with id ${dto.stateId} not found`);
      }
    }

    const {
      code: _code,
      location,
      kycRiskCategory,
      defaultAgent,
      group,
      entityType,
      marketingExecutive,
      businessNature,
      tdsGroup,
      ...updatableFields
    } = normalized;
    const updates = pickDefinedFields(updatableFields);
    Object.assign(client, {
      ...updates,
      dateOfIntro: normalized.dateOfIntro ? new Date(normalized.dateOfIntro) : client.dateOfIntro,
      blockDateFrom:
        normalized.blockDateFrom !== undefined
          ? normalized.blockDateFrom
            ? new Date(normalized.blockDateFrom)
            : null
          : client.blockDateFrom,
      establishmentDate:
        normalized.establishmentDate !== undefined
          ? normalized.establishmentDate
            ? new Date(normalized.establishmentDate)
            : null
          : client.establishmentDate,
      panDob:
        normalized.panDob !== undefined
          ? normalized.panDob
            ? new Date(normalized.panDob)
            : null
          : client.panDob,
      ffmcRegDate:
        normalized.ffmcRegDate !== undefined
          ? normalized.ffmcRegDate
            ? new Date(normalized.ffmcRegDate)
            : null
          : client.ffmcRegDate,
    });
    if (location !== undefined) {
      client.location = location ? ({ id: location } as any) : null;
    }
    if (kycRiskCategory !== undefined) {
      client.kycRiskCategory = kycRiskCategory ? ({ id: kycRiskCategory } as any) : null;
    }
    if (defaultAgent !== undefined) {
      client.defaultAgent = defaultAgent ? ({ id: defaultAgent } as any) : null;
    }
    if (group !== undefined) {
      client.group = group ? ({ id: group } as any) : null;
    }
    if (entityType !== undefined) {
      client.entityType = entityType ? ({ id: entityType } as any) : null;
    }
    if (marketingExecutive !== undefined) {
      client.marketingExecutive = marketingExecutive ? ({ id: marketingExecutive } as any) : null;
    }
    if (businessNature !== undefined) {
      client.businessNature = businessNature ? ({ id: businessNature } as any) : null;
    }
    if (tdsGroup !== undefined) {
      client.tdsGroup = tdsGroup ? ({ id: tdsGroup } as any) : null;
    }
    client.updatedBy = userId;

    await this.partyProfileRepository.save(client);
    return this.findById(id);
  }

  async review(id: string, dto: ReviewPartyProfileDto, userId: string): Promise<PartyProfileResponseDto> {
    const user = await this.getCurrentUser(userId);
    if (!this.isReviewer(user)) {
      throw new ForbiddenException("You are not allowed to review party profiles");
    }

    const client = await this.partyProfileRepository.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException(`Party Profile with id ${id} not found`);
    }

    if (!user?.isAdmin) {
      const branchIds = this.getReviewerBranchIds(user);
      if (!branchIds.length || !client.originBranchId || !branchIds.includes(client.originBranchId)) {
        throw new ForbiddenException("You are not allowed to review this party profile");
      }
    }

    if (dto.status === WorkflowStatus.REJECT && !dto.rejectReason?.trim()) {
      throw new BadRequestException("Reject reason is required when rejecting a profile");
    }

    client.status = dto.status;
    client.active = dto.active;
    client.statusUpdatedById = user.id;
    client.statusUpdatedAt = new Date();
    client.updatedBy = userId;

    const saved = await this.partyProfileRepository.save(client);

    await this.partyProfileStatusChangeLogRepository.save(
      this.partyProfileStatusChangeLogRepository.create({
        partyProfileId: saved.id,
        status: dto.status,
        activeAfterReview: dto.active,
        rejectReason: dto.rejectReason?.trim() || undefined,
        reviewedById: user.id,
      }),
    );

    return this.findById(saved.id);
  }

  async getReviewQueue(userId: string): Promise<PartyProfileResponseDto[]> {
    const user = await this.getCurrentUser(userId);
    if (!this.isReviewer(user)) {
      return [];
    }

    const branchIds = this.getReviewerBranchIds(user);
    const qb = this.partyProfileRepository
      .createQueryBuilder("pp")
      .leftJoinAndSelect("pp.gstState", "gstState")
      .leftJoinAndSelect("pp.state", "state")
      .leftJoinAndSelect("pp.originBranch", "originBranch")
      .leftJoinAndSelect("pp.statusUpdatedBy", "statusUpdatedBy")
      .leftJoinAndSelect("pp.location", "locationOption")
      .leftJoinAndSelect("pp.kycRiskCategory", "kycRiskCategoryOption")
      .leftJoinAndSelect("pp.defaultAgent", "defaultAgentOption")
      .leftJoinAndSelect("pp.group", "groupOption")
      .leftJoinAndSelect("pp.entityType", "entityTypeOption")
      .leftJoinAndSelect("pp.marketingExecutive", "marketingExecutiveOption")
      .leftJoinAndSelect("pp.businessNature", "businessNatureOption")
      .leftJoinAndSelect("pp.tdsGroup", "tdsGroupOption")
      .where("pp.status = :status", { status: WorkflowStatus.PENDING });

    if (!user?.isAdmin) {
      if (branchIds.length === 0) {
        return [];
      }

      qb.andWhere("pp.originBranchId IN (:...branchIds)", { branchIds });
    }

    qb.orderBy("pp.createdAt", "ASC");

    const pending = await qb.getMany();
    return pending.map(client => PartyProfileResponseDto.fromEntity(client));
  }

  async findById(id: string): Promise<PartyProfileResponseDto> {
    return this.findByIdForUser(id, undefined);
  }

  async findByIdForUser(id: string, userId?: string): Promise<PartyProfileResponseDto> {
    const user = userId ? await this.getCurrentUser(userId) : null;
    const client = await this.partyProfileRepository.findOne({
      where: { id },
      relations: [
        "gstState",
        "state",
        "originBranch",
        "statusUpdatedBy",
        "location",
        "kycRiskCategory",
        "defaultAgent",
        "group",
        "entityType",
        "marketingExecutive",
        "businessNature",
        "tdsGroup",
      ],
    });

    if (!client) {
      throw new NotFoundException(`Party Profile with id ${id} not found`);
    }

    if (user) {
      this.assertPartyProfileAccess(user, client.type, "view");
    }

    return PartyProfileResponseDto.fromEntity(client);
  }

  async delete(id: string, userId?: string): Promise<{ message: string }> {
    const user = userId ? await this.getCurrentUser(userId) : null;
    const client = await this.partyProfileRepository.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException(`Party Profile with id ${id} not found`);
    }

    if (user) {
      this.assertPartyProfileAccess(user, client.type, "delete");
    }

    await this.partyProfileRepository.remove(client);
    return { message: `Party Profile with id ${id} deleted successfully` };
  }

  async findAll(
    query: PartyProfileListQueryDto,
    userId?: string,
  ): Promise<PartyProfileListResponseDto> {
    const user = userId ? await this.getCurrentUser(userId) : null;
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const qb = this.partyProfileRepository
      .createQueryBuilder("pp")
      .leftJoinAndSelect("pp.gstState", "gstState")
      .leftJoinAndSelect("pp.state", "state")
      .leftJoinAndSelect("pp.originBranch", "originBranch")
      .leftJoinAndSelect("pp.location", "locationOption")
      .leftJoinAndSelect("pp.kycRiskCategory", "kycRiskCategoryOption")
      .leftJoinAndSelect("pp.defaultAgent", "defaultAgentOption")
      .leftJoinAndSelect("pp.group", "groupOption")
      .leftJoinAndSelect("pp.entityType", "entityTypeOption")
      .leftJoinAndSelect("pp.marketingExecutive", "marketingExecutiveOption")
      .leftJoinAndSelect("pp.businessNature", "businessNatureOption")
      .leftJoinAndSelect("pp.tdsGroup", "tdsGroupOption");

    const types = (query.type?.length ? query.type : [ClientType.CORPORATE_CLIENT]) as ClientType[];
    if (user) {
      types.forEach(type => this.assertPartyProfileAccess(user, type, "view"));
    }
    qb.where("pp.type::text IN (:...types)", { types });

    if (query.search) {
      qb.andWhere(
        new Brackets((searchQb) => {
          searchQb
            .where("pp.code ILIKE :search", { search: `%${query.search}%` })
            .orWhere("pp.name ILIKE :search", { search: `%${query.search}%` })
            .orWhere("pp.city ILIKE :search", { search: `%${query.search}%` })
            .orWhere("pp.pinCode ILIKE :search", { search: `%${query.search}%` })
            .orWhere("pp.phoneNo ILIKE :search", { search: `%${query.search}%` });
        }),
      );
    }

    if (query.code) {
      qb.andWhere("pp.code ILIKE :code", { code: `%${query.code}%` });
    }

    if (query.name) {
      qb.andWhere("pp.name ILIKE :name", { name: `%${query.name}%` });
    }

    if (query.active !== undefined) {
      qb.andWhere("pp.active = :active", { active: query.active });
    }

    qb.orderBy("pp.createdAt", "DESC").skip(skip).take(limit);

    const [data, totalItems] = await qb.getManyAndCount();

    return {
      data: data.map(client => PartyProfileResponseDto.fromEntity(client)),
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    };
  }
}
