import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, In, Repository } from "typeorm";
import { Country, CountryRiskCategory } from "./country.entity";
import { CreateCountryDto } from "./dto/create-country.dto";
import { UpdateCountryDto } from "./dto/update-country.dto";
import { CountryResponseDto } from "./dto/country-response.dto";
import { CountryListQueryDto } from "./dto/country-list-query.dto";
import {
  applyPagination,
  buildPaginatedResponse,
  normalizePagination,
  type PaginatedResponseDto,
} from "../common/pagination";
import { CountryGroup } from "../country-groups/country-group.entity";
import { Branch } from "../branches/branch.entity";
import { User } from "../users/user.entity";
import {
  CountryAccessRuleWithNamesResponseDto,
  CreateCountryAccessRulesDto,
} from "./dto/country-access-rule.dto";
import { UnblockCountryAccess } from "./entities/unblock-country-access.entity";

function normalizeCountryDto(dto: CreateCountryDto | UpdateCountryDto) {
  return {
    ...dto,
    code: dto.code?.trim().toUpperCase(),
    name: dto.name?.trim(),
    lrsCountryCode: dto.lrsCountryCode?.trim()?.toUpperCase(),
    ctrCountryCode: dto.ctrCountryCode?.trim()?.toUpperCase(),
  };
}

function pickDefinedFields<T extends Record<string, unknown>>(
  value: T,
): Partial<T> {
  const entries = Object.entries(value).filter(
    ([, fieldValue]) => fieldValue !== undefined,
  );
  return Object.fromEntries(entries) as Partial<T>;
}

@Injectable()
export class CountryService {
  constructor(
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UnblockCountryAccess)
    private readonly unblockCountryAccessRepository: Repository<UnblockCountryAccess>,
  ) {}

  async create(
    dto: CreateCountryDto,
    userId: string,
  ): Promise<CountryResponseDto> {
    const { countryGroupId, ...normalized } = normalizeCountryDto(dto);

    const existingCountry = await this.countryRepository.findOne({
      where: { code: normalized.code },
    });

    if (existingCountry) {
      throw new ConflictException("Country with this code already exists");
    }

    const country = this.countryRepository.create({
      ...normalized,
      countryGroup: countryGroupId
        ? ({ id: countryGroupId } as CountryGroup)
        : null,
      riskCategory: normalized.riskCategory ?? CountryRiskCategory.Low,
      restrictedCountry: normalized.restrictedCountry ?? false,
      greyListCountry: normalized.greyListCountry ?? false,
      baseCountry: normalized.baseCountry ?? false,
      isCisCountry: normalized.isCisCountry ?? false,
      isBlocked: normalized.isBlocked ?? false,
      blockedAt: normalized.isBlocked ? new Date() : null,
      blockedById: normalized.isBlocked ? userId : null,
      blockedReason: normalized.isBlocked
        ? (normalized.blockedReason ?? null)
        : null,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.countryRepository.save(country);
    return this.findById(saved.id);
  }

  async update(
    id: string,
    dto: UpdateCountryDto,
    userId: string,
  ): Promise<CountryResponseDto> {
    const country = await this.countryRepository.findOne({ where: { id } });

    if (!country) {
      throw new NotFoundException(`Country with id ${id} not found`);
    }

    const { countryGroupId, ...normalized } = normalizeCountryDto(dto);

    const { code: _code, ...updatableFields } = normalized;
    const updates = pickDefinedFields({
      ...updatableFields,
      riskCategory: normalized.riskCategory ?? country.riskCategory,
    });
    Object.assign(country, updates);

    if (countryGroupId !== undefined) {
      country.countryGroup = countryGroupId
        ? ({ id: countryGroupId } as CountryGroup)
        : null;
    }

    if (normalized.isBlocked !== undefined) {
      country.isBlocked = Boolean(normalized.isBlocked);
      country.blockedAt = normalized.isBlocked ? new Date() : null;
      country.blockedById = normalized.isBlocked ? userId : null;
      country.blockedReason = normalized.isBlocked
        ? (normalized.blockedReason ?? null)
        : null;
    }

    if (normalized.blockedReason !== undefined && country.isBlocked) {
      country.blockedReason = normalized.blockedReason ?? null;
    }

    country.updatedBy = userId;

    const saved = await this.countryRepository.save(country);
    return this.findById(saved.id);
  }

  async findById(id: string): Promise<CountryResponseDto> {
    const country = await this.countryRepository.findOne({
      where: { id },
      relations: ["countryGroup"],
    });

    if (!country) {
      throw new NotFoundException(`Country with id ${id} not found`);
    }

    return CountryResponseDto.fromEntity(country);
  }

  async findAll(
    query: CountryListQueryDto,
    session?: { userId?: string; activeBranchId?: string | null },
  ): Promise<PaginatedResponseDto<CountryResponseDto>> {
    const pagination = normalizePagination(query);

    const qb = this.countryRepository
      .createQueryBuilder("country")
      .leftJoinAndSelect("country.countryGroup", "countryGroup");

    if (query.search) {
      qb.andWhere(
        new Brackets((searchQb) => {
          searchQb
            .where("country.code ILIKE :search", {
              search: `%${query.search}%`,
            })
            .orWhere("country.name ILIKE :search", {
              search: `%${query.search}%`,
            })
            .orWhere("country.risk_category::text ILIKE :search", {
              search: `%${query.search}%`,
            })
            .orWhere("countryGroup.name ILIKE :search", {
              search: `%${query.search}%`,
            })
            .orWhere("country.lrs_country_code ILIKE :search", {
              search: `%${query.search}%`,
            })
            .orWhere("country.ctr_country_code ILIKE :search", {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    if (query.code) {
      qb.andWhere("country.code ILIKE :code", { code: `%${query.code}%` });
    }

    if (query.name) {
      qb.andWhere("country.name ILIKE :name", { name: `%${query.name}%` });
    }

    if (query.riskCategory) {
      qb.andWhere("country.risk_category = :riskCategory", {
        riskCategory: query.riskCategory,
      });
    }

    if (query.restrictedCountry !== undefined) {
      qb.andWhere("country.restricted_country = :restrictedCountry", {
        restrictedCountry: query.restrictedCountry,
      });
    }

    if (query.greyListCountry !== undefined) {
      qb.andWhere("country.grey_list_country = :greyListCountry", {
        greyListCountry: query.greyListCountry,
      });
    }

    if (query.baseCountry !== undefined) {
      qb.andWhere("country.base_country = :baseCountry", {
        baseCountry: query.baseCountry,
      });
    }

    if (query.hideRestrictedCountry) {
      qb.andWhere("country.restricted_country = false");
    }

    if (query.hideBaseCountry) {
      qb.andWhere("country.base_country = false");
    }

    if (query.hideBlockedCountry) {
      const userId = String(session?.userId ?? "").trim();
      const activeBranchId = String(session?.activeBranchId ?? "").trim();
      if (!userId || !activeBranchId) {
        qb.andWhere("country.is_blocked = false");
      } else {
        qb.andWhere(
          new Brackets((blockedQb) => {
            blockedQb.where("country.is_blocked = false").orWhere(
              `EXISTS (
                  SELECT 1
                  FROM unblock_country_access access
                  WHERE access.country_id = country.id
                    AND access.branch_id = :activeBranchId
                    AND access.user_id = :userId
                    AND access.is_active = true
                )`,
              { activeBranchId, userId },
            );
          }),
        );
      }
    }

    qb.orderBy("country.createdAt", "DESC");
    applyPagination(qb, pagination);
    const [countries, total] = await qb.getManyAndCount();

    return buildPaginatedResponse(
      countries.map(CountryResponseDto.fromEntity),
      total,
      pagination,
    );
  }

  async assertCountryAllowed(
    countryId: string,
    branchId: string,
    userId: string,
  ): Promise<void> {
    const country = await this.countryRepository.findOne({
      where: { id: countryId },
    });
    if (!country) {
      throw new NotFoundException(`Country with id ${countryId} not found`);
    }

    if (!country.isBlocked) {
      return;
    }

    const activeRule = await this.unblockCountryAccessRepository.findOne({
      where: { countryId, branchId, userId, isActive: true },
    });

    if (!activeRule) {
      throw new BadRequestException(
        `Country ${country.name} is blocked for this branch/user`,
      );
    }
  }

  async assertTravelCountryAllowed(
    countryId: string,
    branchId: string,
    userId: string,
  ): Promise<void> {
    const country = await this.countryRepository.findOne({
      where: { id: countryId },
    });
    if (!country) {
      throw new NotFoundException(`Country with id ${countryId} not found`);
    }

    if (country.baseCountry) {
      throw new BadRequestException(
        `Country ${country.name} cannot be used as a travel country`,
      );
    }

    if (country.restrictedCountry) {
      throw new BadRequestException(
        `Country ${country.name} is restricted and cannot be used as a travel country`,
      );
    }

    if (!country.isBlocked) {
      return;
    }

    const activeRule = await this.unblockCountryAccessRepository.findOne({
      where: { countryId, branchId, userId, isActive: true },
    });

    if (!activeRule) {
      throw new BadRequestException(
        `Country ${country.name} is blocked for this branch/user`,
      );
    }
  }

  async getCountryAccessState(
    countryId: string,
    branchId: string,
    userId: string,
  ) {
    const country = await this.countryRepository.findOne({
      where: { id: countryId },
    });
    if (!country) {
      throw new NotFoundException(`Country with id ${countryId} not found`);
    }

    const activeRule = await this.unblockCountryAccessRepository.findOne({
      where: { countryId, branchId, userId, isActive: true },
    });

    return {
      countryId,
      blocked: Boolean(country.isBlocked) && !activeRule,
      overrideActive: Boolean(activeRule),
      rule: activeRule
        ? {
            id: activeRule.id,
            countryId: activeRule.countryId,
            branchId: activeRule.branchId,
            userId: activeRule.userId,
            isActive: activeRule.isActive,
            revokedAt: activeRule.revokedAt,
            revokedBy: activeRule.revokedBy,
          }
        : null,
    };
  }

  async createCountryAccessRules(
    countryId: string,
    dto: CreateCountryAccessRulesDto,
    actorUserId: string,
  ) {
    const country = await this.countryRepository.findOne({
      where: { id: countryId },
    });
    if (!country) {
      throw new NotFoundException(`Country with id ${countryId} not found`);
    }

    const created: UnblockCountryAccess[] = [];
    for (const rule of dto.rules) {
      const existing = await this.unblockCountryAccessRepository.findOne({
        where: { countryId, branchId: rule.branchId, userId: rule.userId },
      });

      if (existing) {
        existing.isActive = true;
        existing.revokedAt = null;
        existing.revokedBy = null;
        existing.updatedBy = actorUserId;
        created.push(await this.unblockCountryAccessRepository.save(existing));
        continue;
      }

      const entity = this.unblockCountryAccessRepository.create({
        countryId,
        branchId: rule.branchId,
        userId: rule.userId,
        isActive: true,
        revokedAt: null,
        revokedBy: null,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      });
      created.push(await this.unblockCountryAccessRepository.save(entity));
    }

    return created;
  }

  async listCountryAccessRules(
    countryId: string,
  ): Promise<CountryAccessRuleWithNamesResponseDto[]> {
    const rows = await this.unblockCountryAccessRepository.find({
      where: { countryId },
      order: { createdAt: "DESC" },
    });

    const branchIds = [...new Set(rows.map((row) => row.branchId))];
    const userIds = [...new Set(rows.map((row) => row.userId))];
    const [branches, users] = await Promise.all([
      branchIds.length > 0
        ? this.branchRepository.find({ where: { id: In(branchIds) } })
        : Promise.resolve([]),
      userIds.length > 0
        ? this.userRepository.find({ where: { id: In(userIds) } })
        : Promise.resolve([]),
    ]);
    const branchNameById = new Map(
      branches.map((branch) => [branch.id, branch.name ?? null]),
    );
    const userNameById = new Map(
      users.map((user) => [user.id, user.name ?? null]),
    );

    return rows.map((row) => ({
      id: row.id,
      countryId: row.countryId,
      branchId: row.branchId,
      userId: row.userId,
      branchName: branchNameById.get(row.branchId) ?? null,
      userName: userNameById.get(row.userId) ?? null,
      isActive: row.isActive,
      revokedAt: row.revokedAt,
      revokedBy: row.revokedBy,
    }));
  }

  async revokeCountryAccessRule(ruleId: string, actorUserId: string) {
    const rule = await this.unblockCountryAccessRepository.findOne({
      where: { id: ruleId },
    });
    if (!rule) {
      throw new NotFoundException(
        `Country access rule with id ${ruleId} not found`,
      );
    }

    rule.isActive = false;
    rule.revokedAt = new Date();
    rule.revokedBy = actorUserId;
    rule.updatedBy = actorUserId;
    return this.unblockCountryAccessRepository.save(rule);
  }
}
