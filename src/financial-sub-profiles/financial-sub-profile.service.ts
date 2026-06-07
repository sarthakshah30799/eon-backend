import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { FinancialSubProfile } from "./financial-sub-profile.entity";
import { FinancialCode } from "../financial-codes/financial-code.entity";
import { CreateFinancialSubProfileDto } from "./dto/create-financial-sub-profile.dto";
import { UpdateFinancialSubProfileDto } from "./dto/update-financial-sub-profile.dto";
import { FinancialSubProfileResponseDto } from "./dto/financial-sub-profile-response.dto";
import { FinancialSubProfileListQueryDto } from "./dto/financial-sub-profile-list-query.dto";
import { FinancialSubProfileListResponseDto } from "./dto/financial-sub-profile-list-response.dto";

function normalizeFinancialSubProfileDto(dto: CreateFinancialSubProfileDto | UpdateFinancialSubProfileDto) {
  return {
    ...dto,
    financialSubCode: dto.financialSubCode?.trim()?.toUpperCase(),
    financialSubName: dto.financialSubName?.trim()?.toUpperCase(),
  };
}

function pickDefinedFields<T extends Record<string, any>>(value: T): Partial<T> {
  const entries = Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined);
  return Object.fromEntries(entries) as Partial<T>;
}

@Injectable()
export class FinancialSubProfileService {
  constructor(
    @InjectRepository(FinancialSubProfile)
    private readonly financialSubProfileRepository: Repository<FinancialSubProfile>,
    @InjectRepository(FinancialCode)
    private readonly financialCodeRepository: Repository<FinancialCode>,
  ) {}

  async create(dto: CreateFinancialSubProfileDto, userId: string): Promise<FinancialSubProfileResponseDto> {
    const normalized = normalizeFinancialSubProfileDto(dto);
    const financialCode = await this.financialCodeRepository.findOne({
      where: { id: normalized.financialCodeId },
    });

    if (!financialCode) {
      throw new NotFoundException(`Financial Code with id ${normalized.financialCodeId} not found`);
    }

    const existing = await this.financialSubProfileRepository.findOne({
      where: {
        financialCode: { id: financialCode.id },
        financialSubCode: normalized.financialSubCode,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Financial Sub Code "${normalized.financialSubCode}" already exists for this financial category`
      );
    }

    const subProfile = this.financialSubProfileRepository.create({
      ...normalized,
      financialCode,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.financialSubProfileRepository.save(subProfile);
    return this.findById(saved.id);
  }

  async update(id: string, dto: UpdateFinancialSubProfileDto, userId: string): Promise<FinancialSubProfileResponseDto> {
    const subProfile = await this.financialSubProfileRepository.findOne({
      where: { id },
      relations: ["financialCode"],
    });

    if (!subProfile) {
      throw new NotFoundException(`Financial Sub Profile with id ${id} not found`);
    }

    const normalized = normalizeFinancialSubProfileDto(dto);
    let financialCode = subProfile.financialCode;

    if (normalized.financialCodeId && normalized.financialCodeId !== subProfile.financialCode?.id) {
      const nextCode = await this.financialCodeRepository.findOne({
        where: { id: normalized.financialCodeId },
      });

      if (!nextCode) {
        throw new NotFoundException(`Financial Code with id ${normalized.financialCodeId} not found`);
      }

      financialCode = nextCode;
    }

    const candidateSubCode = normalized.financialSubCode ?? subProfile.financialSubCode;

    if (candidateSubCode !== subProfile.financialSubCode || financialCode.id !== subProfile.financialCode?.id) {
      const existing = await this.financialSubProfileRepository.findOne({
        where: {
          financialCode: { id: financialCode.id },
          financialSubCode: candidateSubCode,
        },
      });

      if (existing && existing.id !== subProfile.id) {
        throw new ConflictException(
          `Financial Sub Code "${candidateSubCode}" already exists for this financial category`
        );
      }
    }

    const updates = pickDefinedFields({
      ...normalized,
      financialCode,
    });

    Object.assign(subProfile, updates);
    subProfile.updatedBy = userId;

    const saved = await this.financialSubProfileRepository.save(subProfile);
    return this.findById(saved.id);
  }

  async findById(id: string): Promise<FinancialSubProfileResponseDto> {
    const subProfile = await this.financialSubProfileRepository.findOne({
      where: { id },
      relations: ["financialCode"],
    });

    if (!subProfile) {
      throw new NotFoundException(`Financial Sub Profile with id ${id} not found`);
    }

    return FinancialSubProfileResponseDto.fromEntity(subProfile);
  }

  async delete(id: string): Promise<{ message: string }> {
    const subProfile = await this.financialSubProfileRepository.findOne({ where: { id } });

    if (!subProfile) {
      throw new NotFoundException(`Financial Sub Profile with id ${id} not found`);
    }

    await this.financialSubProfileRepository.remove(subProfile);
    return { message: `Financial Sub Profile with id ${id} deleted successfully` };
  }

  async findAll(query: FinancialSubProfileListQueryDto): Promise<FinancialSubProfileListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const qb = this.financialSubProfileRepository.createQueryBuilder("fsp")
      .leftJoinAndSelect("fsp.financialCode", "fc");

    if (query.search) {
      qb.andWhere(
        new Brackets((searchQb) => {
          searchQb
            .where("fsp.financialSubCode ILIKE :search", { search: `%${query.search}%` })
            .orWhere("fsp.financialSubName ILIKE :search", { search: `%${query.search}%` })
            .orWhere("fc.financialCode ILIKE :search", { search: `%${query.search}%` })
            .orWhere("fc.financialName ILIKE :search", { search: `%${query.search}%` })
            .orWhere("fc.financialType ILIKE :search", { search: `%${query.search}%` });
        }),
      );
    }

    if (query.financialCodeId) {
      qb.andWhere("fc.id = :financialCodeId", { financialCodeId: query.financialCodeId });
    }

    if (query.financialSubCode) {
      qb.andWhere("fsp.financialSubCode ILIKE :financialSubCode", {
        financialSubCode: `%${query.financialSubCode}%`,
      });
    }

    if (query.financialSubName) {
      qb.andWhere("fsp.financialSubName ILIKE :financialSubName", {
        financialSubName: `%${query.financialSubName}%`,
      });
    }

    qb.orderBy("fsp.createdAt", "DESC").skip(skip).take(limit);

    const [data, totalItems] = await qb.getManyAndCount();

    return {
      data: data.map(FinancialSubProfileResponseDto.fromEntity),
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    };
  }
}
