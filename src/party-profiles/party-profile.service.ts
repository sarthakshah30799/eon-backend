import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
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
import { Currency } from "../currencies/currency.entity";
import { Product } from "../products/product.entity";
import { PartyProfileCommissionRule } from "./entities/party-profile-commission-rule.entity";
import {
  PartyProfileCommissionTypeEnum,
  type PartyProfileCommissionType,
} from "./types/party-profile-commission-rule.types";
import {
  parseCommissionRulesCsv,
  serializeCommissionRulesToCsv,
} from "./party-profile-commission-csv.util";

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

type PartyProfileCommissionRuleInput = {
  currencyCode: string;
  currencyName?: string | null;
  productCode: string;
  productDescription?: string | null;
  commissionType: PartyProfileCommissionType;
  commissionValue: string;
};

@Injectable()
export class PartyProfileService {
  private readonly logger = new Logger(PartyProfileService.name);

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
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(PartyProfileCommissionRule)
    private readonly partyProfileCommissionRuleRepository: Repository<PartyProfileCommissionRule>,
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

  private isPartyProfileVisibleToUser(
    client: PartyProfile,
    userId: string | undefined,
    activeBranchId: string | undefined,
    isAdmin: boolean,
  ) {
    if (isAdmin) {
      return true;
    }

    if (!userId || !activeBranchId) {
      return false;
    }

    if (client.branchId !== activeBranchId) {
      return false;
    }

    if (client.active === false) {
      return client.createdBy === userId;
    }

    return true;
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

  private normalizeCommissionRules(
    commissionRules?: PartyProfileCommissionRuleInput[] | null,
  ) {
    if (!Array.isArray(commissionRules)) {
      return undefined;
    }

    return commissionRules.map(rule => ({
      currencyCode: rule.currencyCode?.trim().toUpperCase(),
      currencyName: rule.currencyName?.trim() || null,
      productCode: rule.productCode?.trim().toUpperCase(),
      productDescription: rule.productDescription?.trim() || null,
      commissionType: rule.commissionType,
      commissionValue: rule.commissionValue?.trim(),
    }));
  }

  private async syncCommissionRules(
    client: PartyProfile,
    commissionRules: PartyProfileCommissionRuleInput[] | undefined,
    userId: string,
  ) {
    if (commissionRules === undefined) {
      return;
    }

    if (client.type !== ClientType.AGENT && commissionRules.length > 0) {
      throw new BadRequestException(
        "Commission rules are only available for agent profiles",
      );
    }

    const resolvedRules: Array<{
      currencyCode: string;
      currencyName: string | null;
      productCode: string;
      productDescription: string | null;
      commissionType: PartyProfileCommissionType;
      commissionValue: string;
    }> = [];

    for (const rule of commissionRules) {
      if (
        !rule.currencyCode ||
        !rule.productCode ||
        !rule.commissionType ||
        !rule.commissionValue
      ) {
        throw new BadRequestException(
          "Each commission row must include currencyCode, productCode, commissionType, and commissionValue",
        );
      }

      const currency = await this.currencyRepository.findOne({
        where: { currencyCode: rule.currencyCode },
      });
      if (!currency) {
        throw new BadRequestException(
          `Currency code "${rule.currencyCode}" not found`,
        );
      }

      const product = await this.productRepository.findOne({
        where: { productCode: rule.productCode },
      });
      if (!product) {
        throw new BadRequestException(
          `Product code "${rule.productCode}" not found`,
        );
      }

      resolvedRules.push({
        currencyCode: currency.currencyCode,
        currencyName: currency.currencyName,
        productCode: product.productCode,
        productDescription: product.productDescription,
        commissionType:
          rule.commissionType === PartyProfileCommissionTypeEnum.PERCENTAGE
            ? PartyProfileCommissionTypeEnum.PERCENTAGE
            : PartyProfileCommissionTypeEnum.PAISA,
        commissionValue: rule.commissionValue,
      });
    }

    await this.partyProfileCommissionRuleRepository.delete({
      partyProfileId: client.id,
    });

    if (resolvedRules.length === 0) {
      return;
    }

    await this.partyProfileCommissionRuleRepository.save(
      resolvedRules.map(rule =>
        this.partyProfileCommissionRuleRepository.create({
          partyProfileId: client.id,
          partyProfile: client,
          currencyCode: rule.currencyCode,
          currencyName: rule.currencyName,
          productCode: rule.productCode,
          productDescription: rule.productDescription,
          commissionType: rule.commissionType,
          commissionValue: rule.commissionValue,
          createdBy: userId,
          updatedBy: userId,
        }),
      ),
    );
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
    const commissionRules = this.normalizeCommissionRules(dto.commissionRules);
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

    if (dto.branchId) {
      const branch = await this.branchRepository.findOne({ where: { id: dto.branchId } });
      if (!branch) {
        throw new NotFoundException(`Branch with id ${dto.branchId} not found`);
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
      commissionRules: _commissionRules,
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
    await this.syncCommissionRules(saved, commissionRules, userId);
    return this.findById(saved.id);
  }

  async update(id: string, dto: UpdatePartyProfileDto, userId: string): Promise<PartyProfileResponseDto> {
    const user = await this.getCurrentUser(userId);
    const client = await this.partyProfileRepository.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException(`Party Profile with id ${id} not found`);
    }

    const normalized = normalizeDto(dto);
    const commissionRules = this.normalizeCommissionRules(dto.commissionRules);
    this.assertPartyProfileAccess(user, normalized.type ?? client.type, "modify");

    if (normalized.name && normalized.name !== client.name) {
      const existingName = await this.partyProfileRepository.findOne({
        where: { name: normalized.name },
      });
      if (existingName) {
        throw new ConflictException(`Party Profile Name "${normalized.name}" already exists`);
      }
    }

    if (dto.branchId && dto.branchId !== client.branchId) {
      const branch = await this.branchRepository.findOne({ where: { id: dto.branchId } });
      if (!branch) {
        throw new NotFoundException(`Branch with id ${dto.branchId} not found`);
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
      commissionRules: _commissionRules,
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
    await this.syncCommissionRules(client, commissionRules, userId);
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
      if (!branchIds.length || !client.branchId || !branchIds.includes(client.branchId)) {
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
      .leftJoinAndSelect("pp.branch", "branch")
      .leftJoinAndSelect("pp.statusUpdatedBy", "statusUpdatedBy")
      .leftJoinAndSelect("pp.location", "locationOption")
      .leftJoinAndSelect("pp.kycRiskCategory", "kycRiskCategoryOption")
      .leftJoinAndSelect("pp.defaultAgent", "defaultAgentOption")
      .leftJoinAndSelect("pp.group", "groupOption")
      .leftJoinAndSelect("pp.entityType", "entityTypeOption")
      .leftJoinAndSelect("pp.marketingExecutive", "marketingExecutiveOption")
      .leftJoinAndSelect("pp.businessNature", "businessNatureOption")
      .leftJoinAndSelect("pp.tdsGroup", "tdsGroupOption")
      .leftJoinAndSelect("pp.commissionRules", "commissionRules")
      .where("pp.status = :status", { status: WorkflowStatus.PENDING });

    if (!user?.isAdmin) {
      if (branchIds.length === 0) {
        return [];
      }

      qb.andWhere("pp.branchId IN (:...branchIds)", { branchIds });
    }

    qb.orderBy("pp.createdAt", "ASC");

    const pending = await qb.getMany();
    return pending.map(client => PartyProfileResponseDto.fromEntity(client));
  }

  async findById(id: string): Promise<PartyProfileResponseDto> {
    return this.findByIdForUser(id, undefined);
  }

  async findByIdForUser(
    id: string,
    userId?: string,
    activeBranchId?: string,
  ): Promise<PartyProfileResponseDto> {
    const user = userId ? await this.getCurrentUser(userId) : null;
    const client = await this.partyProfileRepository.findOne({
      where: { id },
      relations: [
        "gstState",
        "state",
        "branch",
        "statusUpdatedBy",
        "location",
        "kycRiskCategory",
        "defaultAgent",
        "group",
        "entityType",
        "marketingExecutive",
        "businessNature",
        "tdsGroup",
        "commissionRules",
      ],
    });

    if (!client) {
      throw new NotFoundException(`Party Profile with id ${id} not found`);
    }

    if (user) {
      this.assertPartyProfileAccess(user, client.type, "view");
      if (!this.isPartyProfileVisibleToUser(client, userId, activeBranchId, user.isAdmin)) {
        throw new NotFoundException(`Party Profile with id ${id} not found`);
      }
    }

    return PartyProfileResponseDto.fromEntity(client);
  }

  async getCommissionTemplate(
    id: string,
    userId?: string,
    activeBranchId?: string,
  ): Promise<string> {
    const user = userId ? await this.getCurrentUser(userId) : null;
    const client = await this.partyProfileRepository.findOne({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException(`Party Profile with id ${id} not found`);
    }

    if (user) {
      this.assertPartyProfileAccess(user, client.type, "view");
      if (!this.isPartyProfileVisibleToUser(client, userId, activeBranchId, user.isAdmin)) {
        throw new NotFoundException(`Party Profile with id ${id} not found`);
      }
    }

    const commissionRules = await this.partyProfileCommissionRuleRepository.find({
      where: { partyProfileId: id },
      order: { currencyCode: "ASC", productCode: "ASC" },
    });

    return serializeCommissionRulesToCsv(
      commissionRules.map(rule => ({
        currencyCode: rule.currencyCode,
        currencyName: rule.currencyName,
        productCode: rule.productCode,
        productDescription: rule.productDescription,
        commissionType: rule.commissionType,
        commissionValue: rule.commissionValue,
      })),
    );
  }

  async uploadCommissionTemplate(
    id: string,
    csvContent: string,
    userId: string,
    activeBranchId?: string,
  ): Promise<PartyProfileResponseDto> {
    const user = await this.getCurrentUser(userId);
    const client = await this.partyProfileRepository.findOne({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException(`Party Profile with id ${id} not found`);
    }

    this.assertPartyProfileAccess(user, client.type, "modify");
    if (!this.isPartyProfileVisibleToUser(client, userId, activeBranchId, user.isAdmin)) {
      throw new NotFoundException(`Party Profile with id ${id} not found`);
    }

    if (client.type !== ClientType.AGENT) {
      throw new BadRequestException(
        "Commission rules are only available for agent profiles",
      );
    }

    const parsedRules = parseCommissionRulesCsv(csvContent);
    const existingRules = await this.partyProfileCommissionRuleRepository.find({
      where: { partyProfileId: client.id },
    });
    const mergedRules = new Map<string, PartyProfileCommissionRule>(
      existingRules.map(rule => [
        `${rule.currencyCode}:${rule.productCode}`,
        rule,
      ]),
    );

    for (const rule of parsedRules) {
      if (
        !rule.currencyCode ||
        !rule.productCode ||
        !rule.commissionType ||
        !rule.commissionValue
      ) {
        throw new BadRequestException(
          "Each commission row must include currencyCode, productCode, commissionType, and commissionValue",
        );
      }

      const currency = await this.currencyRepository.findOne({
        where: { currencyCode: rule.currencyCode },
      });
      if (!currency) {
        throw new BadRequestException(
          `Currency code "${rule.currencyCode}" not found`,
        );
      }

      const product = await this.productRepository.findOne({
        where: { productCode: rule.productCode },
      });
      if (!product) {
        throw new BadRequestException(
          `Product code "${rule.productCode}" not found`,
        );
      }

      const key = `${currency.currencyCode}:${product.productCode}`;
      const existingRule = mergedRules.get(key);
      mergedRules.set(
        key,
        this.partyProfileCommissionRuleRepository.create({
          id: existingRule?.id,
          partyProfileId: client.id,
          partyProfile: client,
          currencyCode: currency.currencyCode,
          currencyName: currency.currencyName,
          productCode: product.productCode,
          productDescription: product.productDescription,
          commissionType:
            rule.commissionType === PartyProfileCommissionTypeEnum.PERCENTAGE
              ? PartyProfileCommissionTypeEnum.PERCENTAGE
              : PartyProfileCommissionTypeEnum.PAISA,
          commissionValue: rule.commissionValue,
          createdBy: existingRule?.createdBy ?? userId,
          updatedBy: userId,
        }),
      );
    }

    client.updatedBy = userId;
    await this.partyProfileRepository.save(client);
    await this.partyProfileCommissionRuleRepository.upsert(
      Array.from(mergedRules.values()).map(rule => ({
        id: rule.id,
        partyProfileId: rule.partyProfileId,
        currencyCode: rule.currencyCode,
        currencyName: rule.currencyName,
        productCode: rule.productCode,
        productDescription: rule.productDescription,
        commissionType: rule.commissionType,
        commissionValue: rule.commissionValue,
        createdBy: rule.createdBy,
        updatedBy: rule.updatedBy,
      })),
      ["partyProfileId", "currencyCode", "productCode"],
    );

    return this.findById(id);
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
    activeBranchId?: string,
  ): Promise<PartyProfileListResponseDto> {
    const user = userId ? await this.getCurrentUser(userId) : null;
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    this.logger.debug(
      `findAll called with query=${JSON.stringify({
        ...query,
        userId,
        activeBranchId,
      })}`,
    );
    this.logger.debug(
      `findAll resolved paging page=${page}, limit=${limit}, skip=${skip}`,
    );

    const qb = this.partyProfileRepository
      .createQueryBuilder("pp")
      .leftJoinAndSelect("pp.gstState", "gstState")
      .leftJoinAndSelect("pp.state", "state")
      .leftJoinAndSelect("pp.branch", "branch")
      .leftJoinAndSelect("pp.location", "locationOption")
      .leftJoinAndSelect("pp.kycRiskCategory", "kycRiskCategoryOption")
      .leftJoinAndSelect("pp.defaultAgent", "defaultAgentOption")
      .leftJoinAndSelect("pp.group", "groupOption")
      .leftJoinAndSelect("pp.entityType", "entityTypeOption")
      .leftJoinAndSelect("pp.marketingExecutive", "marketingExecutiveOption")
      .leftJoinAndSelect("pp.businessNature", "businessNatureOption")
      .leftJoinAndSelect("pp.tdsGroup", "tdsGroupOption");

    if (!user?.isAdmin && !activeBranchId) {
      this.logger.debug(
        "findAll returning empty list because activeBranchId is missing for a non-admin user",
      );
      return {
        data: [],
        page,
        limit,
        totalItems: 0,
        totalPages: 0,
      };
    }

    if (!user?.isAdmin && activeBranchId) {
      qb.andWhere("pp.branchId = :branchId", { branchId: activeBranchId });
      this.logger.debug(
        `findAll applied branch filter branchId=${activeBranchId} for non-admin user`,
      );
    } else {
      this.logger.debug("findAll skipped branch filter because user is admin");
    }

    if (query.sale !== undefined) {
      qb.andWhere("pp.sale = :sale", { sale: query.sale });
    }

    if (query.purchase !== undefined) {
      qb.andWhere("pp.purchase = :purchase", { purchase: query.purchase });
    }

    const requestedTypes = (query.type?.length
      ? query.type
      : [ClientType.CORPORATE_CLIENT]) as ClientType[];
    const accessibleTypes = user
      ? requestedTypes.filter(type => this.canAccessPartyProfileType(user, type, "view"))
      : requestedTypes;

    this.logger.debug(
      `findAll requestedTypes=${JSON.stringify(requestedTypes)}, accessibleTypes=${JSON.stringify(accessibleTypes)}`,
    );

    if (accessibleTypes.length === 0) {
      this.logger.debug("findAll returning empty list because accessibleTypes is empty");
      return {
        data: [],
        page,
        limit,
        totalItems: 0,
        totalPages: 0,
      };
    }

    qb.where("pp.type::text IN (:...types)", { types: accessibleTypes });

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

    const restrictToOwnInactiveRecords =
      !user?.isAdmin &&
      Boolean(userId) &&
      (query.activeOnly === false || query.active === false);

    if (restrictToOwnInactiveRecords) {
      qb.andWhere("pp.createdBy = :createdBy", { createdBy: userId });
      this.logger.debug(
        `findAll restricted to createdBy=${userId} for non-admin inactive fetch`,
      );
    }

    if (query.active !== undefined) {
      qb.andWhere("pp.active = :active", { active: query.active });
      this.logger.debug(`findAll applied active filter from active=${query.active}`);
    } else if (!restrictToOwnInactiveRecords) {
      qb.andWhere("pp.active = true");
      this.logger.debug("findAll applied default active=true filter");
    } else {
      this.logger.debug("findAll skipped active filter because inactive fetch is restricted to creator");
    }

    this.logger.debug(`findAll sql=${qb.getSql()}`);

    qb.orderBy("pp.createdAt", "DESC").skip(skip).take(limit);

    const [data, totalItems] = await qb.getManyAndCount();

    this.logger.debug(
      `findAll result count=${data.length}, totalItems=${totalItems}, activeStatuses=${JSON.stringify(
        data.map(client => ({ id: client.id, active: client.active, type: client.type })),
      )}`,
    );

    return {
      data: data.map(client => PartyProfileResponseDto.fromEntity(client)),
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    };
  }
}
