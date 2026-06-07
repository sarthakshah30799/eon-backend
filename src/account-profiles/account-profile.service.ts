import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { AccountProfile } from "./account-profile.entity";
import { Currency } from "../currencies/currency.entity";
import { FinancialCode } from "../financial-codes/financial-code.entity";
import { FinancialSubProfile } from "../financial-sub-profiles/financial-sub-profile.entity";
import { Branch } from "../branches/branch.entity";
import { CreateAccountProfileDto } from "./dto/create-account-profile.dto";
import { UpdateAccountProfileDto } from "./dto/update-account-profile.dto";
import { AccountProfileResponseDto } from "./dto/account-profile-response.dto";
import { AccountProfileListQueryDto } from "./dto/account-profile-list-query.dto";
import { AccountProfileListResponseDto } from "./dto/account-profile-list-response.dto";

function normalizeDto(dto: CreateAccountProfileDto | UpdateAccountProfileDto) {
  return {
    ...dto,
    accountCode: dto.accountCode?.trim().toUpperCase(),
    accountName: dto.accountName?.trim(),
    divisionDept: dto.divisionDept?.trim(),
    accountType: dto.accountType?.trim(),
    subLedger: dto.subLedger?.trim(),
    bankNature: dto.bankNature?.trim(),
    pettyCashExpenseId: dto.pettyCashExpenseId?.trim(),
  };
}

function pickDefinedFields<T extends Record<string, any>>(value: T): Partial<T> {
  const entries = Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined);
  return Object.fromEntries(entries) as Partial<T>;
}

@Injectable()
export class AccountProfileService {
  constructor(
    @InjectRepository(AccountProfile)
    private readonly accountProfileRepository: Repository<AccountProfile>,
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(FinancialCode)
    private readonly financialCodeRepository: Repository<FinancialCode>,
    @InjectRepository(FinancialSubProfile)
    private readonly financialSubProfileRepository: Repository<FinancialSubProfile>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
  ) {}

  async create(dto: CreateAccountProfileDto, userId: string): Promise<AccountProfileResponseDto> {
    const normalized = normalizeDto(dto);

    // Validate Account Code uniqueness
    const existingCode = await this.accountProfileRepository.findOne({
      where: { accountCode: normalized.accountCode },
    });
    if (existingCode) {
      throw new ConflictException(`Account Code "${normalized.accountCode}" already exists`);
    }

    // Validate Account Name uniqueness (case-insensitive due to citext)
    const existingName = await this.accountProfileRepository.findOne({
      where: { accountName: normalized.accountName },
    });
    if (existingName) {
      throw new ConflictException(`Account Name "${normalized.accountName}" already exists`);
    }

    // Validate Currency exists
    const currency = await this.currencyRepository.findOne({ where: { id: dto.currencyId } });
    if (!currency) {
      throw new NotFoundException(`Currency with id ${dto.currencyId} not found`);
    }

    // Validate Financial Code exists
    const financialCode = await this.financialCodeRepository.findOne({ where: { id: dto.financialCodeId } });
    if (!financialCode) {
      throw new NotFoundException(`Financial Code with id ${dto.financialCodeId} not found`);
    }

    // Validate Financial Sub Profile exists if provided
    if (dto.financialSubProfileId) {
      const sub = await this.financialSubProfileRepository.findOne({
        where: { id: dto.financialSubProfileId, financialCode: { id: dto.financialCodeId } },
      });
      if (!sub) {
        throw new NotFoundException(`Financial Sub Code with id ${dto.financialSubProfileId} not found under selected Financial Code`);
      }
    }

    // Validate Branch exists if provided
    if (dto.branchIdToTransfer) {
      const branch = await this.branchRepository.findOne({ where: { id: dto.branchIdToTransfer } });
      if (!branch) {
        throw new NotFoundException(`Branch with id ${dto.branchIdToTransfer} not found`);
      }
    }

    // Validate Map To Account exists if provided
    if (dto.mapToAccountId) {
      const mapAcc = await this.accountProfileRepository.findOne({ where: { id: dto.mapToAccountId } });
      if (!mapAcc) {
        throw new NotFoundException(`Map To Account with id ${dto.mapToAccountId} not found`);
      }
    }

    const account = this.accountProfileRepository.create({
      ...normalized,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.accountProfileRepository.save(account);
    return this.findById(saved.id);
  }

  async update(id: string, dto: UpdateAccountProfileDto, userId: string): Promise<AccountProfileResponseDto> {
    const account = await this.accountProfileRepository.findOne({ where: { id } });
    if (!account) {
      throw new NotFoundException(`Account Profile with id ${id} not found`);
    }

    const normalized = normalizeDto(dto);

    // Validate Code uniqueness if changing
    if (normalized.accountCode && normalized.accountCode !== account.accountCode) {
      const existingCode = await this.accountProfileRepository.findOne({
        where: { accountCode: normalized.accountCode },
      });
      if (existingCode) {
        throw new ConflictException(`Account Code "${normalized.accountCode}" already exists`);
      }
    }

    // Validate Name uniqueness if changing
    if (normalized.accountName && normalized.accountName !== account.accountName) {
      const existingName = await this.accountProfileRepository.findOne({
        where: { accountName: normalized.accountName },
      });
      if (existingName) {
        throw new ConflictException(`Account Name "${normalized.accountName}" already exists`);
      }
    }

    // Validate Currency if provided
    if (dto.currencyId && dto.currencyId !== account.currencyId) {
      const currency = await this.currencyRepository.findOne({ where: { id: dto.currencyId } });
      if (!currency) {
        throw new NotFoundException(`Currency with id ${dto.currencyId} not found`);
      }
    }

    // Validate Financial Code and Subcode if provided
    const targetFinancialCodeId = dto.financialCodeId ?? account.financialCodeId;
    if (dto.financialCodeId && dto.financialCodeId !== account.financialCodeId) {
      const financialCode = await this.financialCodeRepository.findOne({ where: { id: dto.financialCodeId } });
      if (!financialCode) {
        throw new NotFoundException(`Financial Code with id ${dto.financialCodeId} not found`);
      }
    }

    if (dto.financialSubProfileId) {
      const sub = await this.financialSubProfileRepository.findOne({
        where: { id: dto.financialSubProfileId, financialCode: { id: targetFinancialCodeId } },
      });
      if (!sub) {
        throw new NotFoundException(`Financial Sub Code with id ${dto.financialSubProfileId} not found under selected Financial Code`);
      }
    }

    // Validate Branch if provided
    if (dto.branchIdToTransfer) {
      const branch = await this.branchRepository.findOne({ where: { id: dto.branchIdToTransfer } });
      if (!branch) {
        throw new NotFoundException(`Branch with id ${dto.branchIdToTransfer} not found`);
      }
    }

    // Validate Map To Account if provided
    if (dto.mapToAccountId) {
      if (dto.mapToAccountId === id) {
        throw new ConflictException("An account profile cannot map to itself");
      }
      const mapAcc = await this.accountProfileRepository.findOne({ where: { id: dto.mapToAccountId } });
      if (!mapAcc) {
        throw new NotFoundException(`Map To Account with id ${dto.mapToAccountId} not found`);
      }
    }

    const updates = pickDefinedFields(normalized);
    Object.assign(account, updates);
    account.updatedBy = userId;

    await this.accountProfileRepository.save(account);
    return this.findById(id);
  }

  async findById(id: string): Promise<AccountProfileResponseDto> {
    const account = await this.accountProfileRepository.findOne({
      where: { id },
      relations: ["currency", "financialCode", "financialSubProfile", "branchToTransfer", "mapToAccount"],
    });

    if (!account) {
      throw new NotFoundException(`Account Profile with id ${id} not found`);
    }

    return AccountProfileResponseDto.fromEntity(account);
  }

  async delete(id: string): Promise<{ message: string }> {
    const account = await this.accountProfileRepository.findOne({ where: { id } });
    if (!account) {
      throw new NotFoundException(`Account Profile with id ${id} not found`);
    }

    // Check if this account is mapped in mapToAccountId of another account
    const isReferenced = await this.accountProfileRepository.findOne({
      where: { mapToAccountId: id },
    });
    if (isReferenced) {
      throw new ConflictException("Cannot delete this Account Profile because it is mapped to another Account Profile");
    }

    await this.accountProfileRepository.remove(account);
    return { message: `Account Profile with id ${id} deleted successfully` };
  }

  async findAll(query: AccountProfileListQueryDto): Promise<AccountProfileListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const qb = this.accountProfileRepository.createQueryBuilder("ap")
      .leftJoinAndSelect("ap.currency", "currency")
      .leftJoinAndSelect("ap.financialCode", "financialCode")
      .leftJoinAndSelect("ap.financialSubProfile", "financialSubProfile")
      .leftJoinAndSelect("ap.branchToTransfer", "branchToTransfer")
      .leftJoinAndSelect("ap.mapToAccount", "mapToAccount");

    if (query.search) {
      qb.andWhere(
        new Brackets((searchQb) => {
          searchQb
            .where("ap.accountCode ILIKE :search", { search: `%${query.search}%` })
            .orWhere("ap.accountName ILIKE :search", { search: `%${query.search}%` })
            .orWhere("ap.divisionDept ILIKE :search", { search: `%${query.search}%` });
        }),
      );
    }

    if (query.accountCode) {
      qb.andWhere("ap.accountCode ILIKE :accountCode", { accountCode: `%${query.accountCode}%` });
    }

    if (query.accountName) {
      qb.andWhere("ap.accountName ILIKE :accountName", { accountName: `%${query.accountName}%` });
    }

    if (query.financialCodeId) {
      qb.andWhere("ap.financialCodeId = :financialCodeId", { financialCodeId: query.financialCodeId });
    }

    if (query.currencyId) {
      qb.andWhere("ap.currencyId = :currencyId", { currencyId: query.currencyId });
    }

    if (query.active !== undefined) {
      qb.andWhere("ap.active = :active", { active: query.active });
    }

    qb.orderBy("ap.createdAt", "DESC").skip(skip).take(limit);

    const [data, totalItems] = await qb.getManyAndCount();

    return {
      data: data.map(AccountProfileResponseDto.fromEntity),
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    };
  }
}
