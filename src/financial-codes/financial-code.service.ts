import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { FinancialCode } from "./financial-code.entity";
import { FinancialSubProfile } from "../financial-sub-profiles/financial-sub-profile.entity";
import { CreateFinancialCodeDto } from "./dto/create-financial-code.dto";
import { UpdateFinancialCodeDto } from "./dto/update-financial-code.dto";
import { FinancialCodeResponseDto } from "./dto/financial-code-response.dto";
import { FinancialCodeListQueryDto } from "./dto/financial-code-list-query.dto";
import { FinancialCodeListResponseDto } from "./dto/financial-code-list-response.dto";

function normalizeFinancialCodeDto(dto: CreateFinancialCodeDto | UpdateFinancialCodeDto) {
  return {
    ...dto,
    financialType: dto.financialType?.trim()?.toUpperCase(),
    financialCode: dto.financialCode?.trim()?.toUpperCase(),
    financialName: dto.financialName?.trim()?.toUpperCase(),
    defaultSign: dto.defaultSign?.trim()?.toUpperCase(),
  };
}

function pickDefinedFields<T extends Record<string, any>>(value: T): Partial<T> {
  const entries = Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined);
  return Object.fromEntries(entries) as Partial<T>;
}

@Injectable()
export class FinancialCodeService {
  constructor(
    @InjectRepository(FinancialCode)
    private readonly financialCodeRepository: Repository<FinancialCode>,
    @InjectRepository(FinancialSubProfile)
    private readonly financialSubProfileRepository: Repository<FinancialSubProfile>,
  ) {}

  async create(dto: CreateFinancialCodeDto, userId: string): Promise<FinancialCodeResponseDto> {
    const normalized = normalizeFinancialCodeDto(dto);

    const existing = await this.financialCodeRepository.findOne({
      where: { financialCode: normalized.financialCode },
    });

    if (existing) {
      throw new ConflictException(`Financial Code "${normalized.financialCode}" already exists`);
    }

    const { subProfiles: subProfilesDto, ...parentData } = normalized;

    const subProfiles = (subProfilesDto ?? []).map(sp => {
      return this.financialSubProfileRepository.create({
        financialSubCode: sp.financialSubCode.trim().toUpperCase(),
        financialSubName: sp.financialSubName.trim().toUpperCase(),
        priority: sp.priority,
        createdBy: userId,
        updatedBy: userId,
      });
    });

    const code = this.financialCodeRepository.create({
      ...parentData,
      subProfiles,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.financialCodeRepository.save(code);
    return this.findById(saved.id);
  }

  async update(id: string, dto: UpdateFinancialCodeDto, userId: string): Promise<FinancialCodeResponseDto> {
    const code = await this.financialCodeRepository.findOne({
      where: { id },
      relations: ["subProfiles"],
    });

    if (!code) {
      throw new NotFoundException(`Financial Code with id ${id} not found`);
    }

    const normalized = normalizeFinancialCodeDto(dto);

    const { financialCode: _financialCode, subProfiles: subProfilesDto, ...parentData } = normalized;
    const updates = pickDefinedFields(parentData);
    Object.assign(code, updates);
    code.updatedBy = userId;

    if (subProfilesDto !== undefined) {
      const existingSubs = code.subProfiles ?? [];

      // 1. Identify which existing sub-profiles to delete
      const incomingIds = subProfilesDto.map(ns => ns.id).filter(Boolean);
      const toDelete = existingSubs.filter(es => !incomingIds.includes(es.id));
      if (toDelete.length > 0) {
        await this.financialSubProfileRepository.remove(toDelete);
      }

      // 2. Map incoming to create/update
      code.subProfiles = subProfilesDto.map(ns => {
        if (ns.id) {
          const matched = existingSubs.find(es => es.id === ns.id);
          if (matched) {
            matched.financialSubCode = ns.financialSubCode.trim().toUpperCase();
            matched.financialSubName = ns.financialSubName.trim().toUpperCase();
            matched.priority = ns.priority;
            matched.updatedBy = userId;
            return matched;
          }
        }
        return this.financialSubProfileRepository.create({
          financialSubCode: ns.financialSubCode.trim().toUpperCase(),
          financialSubName: ns.financialSubName.trim().toUpperCase(),
          priority: ns.priority,
          createdBy: userId,
          updatedBy: userId,
        });
      });
    }

    const saved = await this.financialCodeRepository.save(code);
    return this.findById(saved.id);
  }

  async findById(id: string): Promise<FinancialCodeResponseDto> {
    const code = await this.financialCodeRepository.findOne({
      where: { id },
      relations: ["subProfiles"],
    });

    if (!code) {
      throw new NotFoundException(`Financial Code with id ${id} not found`);
    }

    return FinancialCodeResponseDto.fromEntity(code);
  }

  async findByCode(financialCode: string): Promise<FinancialCodeResponseDto> {
    const code = await this.financialCodeRepository.findOne({
      where: { financialCode: financialCode.toUpperCase() },
      relations: ["subProfiles"],
    });

    if (!code) {
      throw new NotFoundException(`Financial Code "${financialCode}" not found`);
    }

    return FinancialCodeResponseDto.fromEntity(code);
  }

  async delete(id: string): Promise<{ message: string }> {
    const code = await this.financialCodeRepository.findOne({
      where: { id },
      relations: ["subProfiles"],
    });

    if (!code) {
      throw new NotFoundException(`Financial Code with id ${id} not found`);
    }

    try {
      // Delete sub profiles first to avoid foreign key restrict violation
      if (code.subProfiles && code.subProfiles.length > 0) {
        await this.financialSubProfileRepository.remove(code.subProfiles);
      }

      await this.financialCodeRepository.remove(code);
      return { message: `Financial Code with id ${id} deleted successfully` };
    } catch (error) {
      if (error.code === "23503") {
        throw new ConflictException(
          "Cannot delete Financial Code because it is mapped in an Account Profile"
        );
      }
      throw error;
    }
  }

  async findAll(query: FinancialCodeListQueryDto): Promise<FinancialCodeListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const qb = this.financialCodeRepository.createQueryBuilder("fc").leftJoinAndSelect("fc.subProfiles", "subProfiles");

    if (query.search) {
      qb.andWhere(
        new Brackets((searchQb) => {
          searchQb
            .where("fc.financialType ILIKE :search", { search: `%${query.search}%` })
            .orWhere("fc.financialCode ILIKE :search", { search: `%${query.search}%` })
            .orWhere("fc.financialName ILIKE :search", { search: `%${query.search}%` })
            .orWhere("fc.defaultSign ILIKE :search", { search: `%${query.search}%` });
        }),
      );
    }

    if (query.financialType) {
      qb.andWhere("fc.financialType ILIKE :financialType", {
        financialType: `%${query.financialType}%`,
      });
    }

    if (query.financialCode) {
      qb.andWhere("fc.financialCode ILIKE :financialCode", {
        financialCode: `%${query.financialCode}%`,
      });
    }

    if (query.financialName) {
      qb.andWhere("fc.financialName ILIKE :financialName", {
        financialName: `%${query.financialName}%`,
      });
    }

    qb.orderBy("fc.createdAt", "DESC").skip(skip).take(limit);

    const [data, totalItems] = await qb.getManyAndCount();

    return {
      data: data.map(FinancialCodeResponseDto.fromEntity),
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    };
  }
}
