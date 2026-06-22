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

function normalizeDto(dto: CreatePartyProfileDto | UpdatePartyProfileDto) {
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
      relations: ["userRoles", "userRoles.role", "userRoles.branch"],
    });
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

  getTypes() {
    return [
      { value: ClientType.CORPORATE_CLIENT, label: 'Party Profile' },
      { value: ClientType.FFMC, label: 'FFMC' },
      { value: ClientType.AUTHORISED_DEALER, label: 'Authorised Dealer' },
      { value: ClientType.RMC, label: 'RMC' },
      { value: ClientType.FRANCHISE, label: 'Franchise' },
      { value: ClientType.AGENT, label: 'Agent' },
      { value: ClientType.FOREIGN_CORRESPONDENT, label: 'Foreign Correspondent' },
      { value: ClientType.MARKETING_EXECUTIVE, label: 'Marketing Executive' },
      { value: ClientType.CARD_ISSUER_PROFILE, label: 'Card Issuer Profile' },
      { value: ClientType.MISC_PROFILE, label: 'MISC Profile' },
    ];
  }

  async create(dto: CreatePartyProfileDto, userId: string): Promise<PartyProfileResponseDto> {
    const normalized = normalizeDto(dto);

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

    const client = this.partyProfileRepository.create({
      ...normalized,
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
    const client = await this.partyProfileRepository.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException(`Party Profile with id ${id} not found`);
    }

    const normalized = normalizeDto(dto);

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

    const { code: _code, ...updatableFields } = normalized;
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
      .leftJoinAndSelect("pp.originBranch", "originBranch")
      .leftJoinAndSelect("pp.statusUpdatedBy", "statusUpdatedBy")
      .where("pp.status = :status", { status: WorkflowStatus.PENDING });

    if (!user?.isAdmin) {
      if (branchIds.length === 0) {
        return [];
      }

      qb.andWhere("pp.originBranchId IN (:...branchIds)", { branchIds });
    }

    qb.orderBy("pp.createdAt", "ASC");

    const pending = await qb.getMany();
    return pending.map(PartyProfileResponseDto.fromEntity);
  }

  async findById(id: string): Promise<PartyProfileResponseDto> {
    const client = await this.partyProfileRepository.findOne({
      where: { id },
      relations: ["gstState", "originBranch", "statusUpdatedBy"],
    });

    if (!client) {
      throw new NotFoundException(`Party Profile with id ${id} not found`);
    }

    return PartyProfileResponseDto.fromEntity(client);
  }

  async delete(id: string): Promise<{ message: string }> {
    const client = await this.partyProfileRepository.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException(`Party Profile with id ${id} not found`);
    }

    await this.partyProfileRepository.remove(client);
    return { message: `Party Profile with id ${id} deleted successfully` };
  }

  async findAll(query: PartyProfileListQueryDto): Promise<PartyProfileListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const qb = this.partyProfileRepository
      .createQueryBuilder("pp")
      .leftJoinAndSelect("pp.gstState", "gstState")
      .leftJoinAndSelect("pp.originBranch", "originBranch");

    const type = query.type ?? ClientType.CORPORATE_CLIENT;
    qb.where("pp.type = :type", { type });

    if (query.search) {
      qb.andWhere(
        new Brackets((searchQb) => {
          searchQb
            .where("pp.code ILIKE :search", { search: `%${query.search}%` })
            .orWhere("pp.name ILIKE :search", { search: `%${query.search}%` })
            .orWhere("pp.city ILIKE :search", { search: `%${query.search}%` });
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
      data: data.map(PartyProfileResponseDto.fromEntity),
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    };
  }
}
