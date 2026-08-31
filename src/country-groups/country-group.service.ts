import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { CountryGroup } from "./country-group.entity";
import { CreateCountryGroupDto } from "./dto/create-country-group.dto";
import { UpdateCountryGroupDto } from "./dto/update-country-group.dto";
import { CountryGroupResponseDto } from "./dto/country-group-response.dto";
import { CountryGroupListQueryDto } from "./dto/country-group-list-query.dto";
import { Currency } from "../currencies/currency.entity";
import {
  applyPagination,
  buildPaginatedResponse,
  normalizePagination,
  type PaginatedResponseDto,
} from "../common/pagination";

@Injectable()
export class CountryGroupService {
  constructor(
    @InjectRepository(CountryGroup)
    private readonly countryGroupRepository: Repository<CountryGroup>,
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
  ) {}

  private generateCode(name: string): string {
    return name.trim().toUpperCase().replace(/\s+/g, "_");
  }

  private validateLimitPair(
    sellLimitAmount: number | null,
    sellLimitCurrencyId: string | null,
  ) {
    const hasAmount = sellLimitAmount !== null && sellLimitAmount !== undefined;
    const hasCurrency = Boolean(sellLimitCurrencyId);

    if (hasAmount !== hasCurrency) {
      throw new BadRequestException(
        "Sell limit amount and sell limit currency must be provided together",
      );
    }
  }

  private validateTravelDays(
    minTravelDays: number | null,
    maxTravelDays: number | null,
  ) {
    if (
      minTravelDays !== null &&
      minTravelDays !== undefined &&
      maxTravelDays !== null &&
      maxTravelDays !== undefined &&
      minTravelDays > maxTravelDays
    ) {
      throw new BadRequestException(
        "Minimum travel days cannot be greater than maximum travel days",
      );
    }
  }

  private async validateActiveCurrency(currencyId: string): Promise<void> {
    const currency = await this.currencyRepository.findOne({
      where: { id: currencyId, active: true },
    });

    if (!currency) {
      throw new BadRequestException(
        `Active currency with id ${currencyId} not found`,
      );
    }
  }

  async findAll(
    query?: CountryGroupListQueryDto,
  ): Promise<PaginatedResponseDto<CountryGroupResponseDto>> {
    const pagination = normalizePagination(query);
    const qb = this.countryGroupRepository
      .createQueryBuilder("countryGroup")
      .leftJoinAndSelect("countryGroup.sellLimitCurrency", "sellLimitCurrency")
      .orderBy("countryGroup.createdAt", "DESC");

    const search = query?.search?.trim();
    if (search) {
      qb.andWhere(
        new Brackets((searchQb) => {
          searchQb
            .where("countryGroup.name ILIKE :search", { search: `%${search}%` })
            .orWhere("countryGroup.code ILIKE :search", {
              search: `%${search}%`,
            });
        }),
      );
    }

    applyPagination(qb, pagination);
    const [groups, total] = await qb.getManyAndCount();
    return buildPaginatedResponse(
      groups.map(CountryGroupResponseDto.fromEntity),
      total,
      pagination,
    );
  }

  async findById(id: string): Promise<CountryGroupResponseDto> {
    const group = await this.countryGroupRepository.findOne({
      where: { id },
      relations: {
        sellLimitCurrency: true,
      },
    });
    if (!group) {
      throw new NotFoundException(`Country Group with id ${id} not found`);
    }
    return CountryGroupResponseDto.fromEntity(group);
  }

  async create(
    dto: CreateCountryGroupDto,
    userId: string,
  ): Promise<CountryGroupResponseDto> {
    const name = dto.name.trim();
    const code = dto.code
      ? dto.code.trim().toUpperCase()
      : this.generateCode(name);
    const sellLimitAmount = dto.sellLimitAmount ?? null;
    const sellLimitCurrencyId = dto.sellLimitCurrencyId ?? null;
    const minTravelDays = dto.minTravelDays ?? null;
    const maxTravelDays = dto.maxTravelDays ?? null;

    this.validateLimitPair(sellLimitAmount, sellLimitCurrencyId);
    this.validateTravelDays(minTravelDays, maxTravelDays);
    if (sellLimitCurrencyId) {
      await this.validateActiveCurrency(sellLimitCurrencyId);
    }

    // Validate uniqueness of code
    const existingCode = await this.countryGroupRepository.findOne({
      where: { code },
    });
    if (existingCode) {
      throw new ConflictException(
        `Country Group with code "${code}" already exists`,
      );
    }

    // Validate uniqueness of name
    const existingName = await this.countryGroupRepository.findOne({
      where: { name },
    });
    if (existingName) {
      throw new ConflictException(
        `Country Group with name "${name}" already exists`,
      );
    }

    const group = this.countryGroupRepository.create({
      name,
      code,
      sellLimitAmount:
        sellLimitAmount !== null && sellLimitAmount !== undefined
          ? String(sellLimitAmount)
          : null,
      sellLimitCurrency: sellLimitCurrencyId
        ? ({ id: sellLimitCurrencyId } as Currency)
        : null,
      sellLimitCurrencyId,
      minTravelDays,
      maxTravelDays,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.countryGroupRepository.save(group);
    return this.findById(saved.id);
  }

  async update(
    id: string,
    dto: UpdateCountryGroupDto,
    userId: string,
  ): Promise<CountryGroupResponseDto> {
    const group = await this.countryGroupRepository.findOne({ where: { id } });
    if (!group) {
      throw new NotFoundException(`Country Group with id ${id} not found`);
    }

    const nextName = dto.name !== undefined ? dto.name.trim() : group.name;
    const nextSellLimitAmount =
      dto.sellLimitAmount !== undefined
        ? dto.sellLimitAmount
        : group.sellLimitAmount === null
          ? null
          : Number(group.sellLimitAmount);
    const nextSellLimitCurrencyId =
      dto.sellLimitCurrencyId !== undefined
        ? (dto.sellLimitCurrencyId ?? null)
        : group.sellLimitCurrencyId;
    const nextMinTravelDays =
      dto.minTravelDays !== undefined
        ? (dto.minTravelDays ?? null)
        : group.minTravelDays;
    const nextMaxTravelDays =
      dto.maxTravelDays !== undefined
        ? (dto.maxTravelDays ?? null)
        : group.maxTravelDays;

    this.validateLimitPair(nextSellLimitAmount, nextSellLimitCurrencyId);
    this.validateTravelDays(nextMinTravelDays, nextMaxTravelDays);
    if (nextSellLimitCurrencyId) {
      await this.validateActiveCurrency(nextSellLimitCurrencyId);
    }

    if (dto.name !== undefined) {
      if (nextName.toLowerCase() !== group.name.toLowerCase()) {
        const existingName = await this.countryGroupRepository.findOne({
          where: { name: nextName },
        });
        if (existingName) {
          throw new ConflictException(
            `Country Group with name "${nextName}" already exists`,
          );
        }
      }
      group.name = nextName;
    }

    if (dto.sellLimitAmount !== undefined) {
      group.sellLimitAmount =
        dto.sellLimitAmount === null ? null : String(dto.sellLimitAmount);
    }

    if (dto.sellLimitCurrencyId !== undefined) {
      group.sellLimitCurrency = dto.sellLimitCurrencyId
        ? ({ id: dto.sellLimitCurrencyId } as Currency)
        : null;
      group.sellLimitCurrencyId = dto.sellLimitCurrencyId ?? null;
    }

    if (dto.minTravelDays !== undefined) {
      group.minTravelDays = dto.minTravelDays ?? null;
    }

    if (dto.maxTravelDays !== undefined) {
      group.maxTravelDays = dto.maxTravelDays ?? null;
    }

    group.updatedBy = userId;
    const saved = await this.countryGroupRepository.save(group);
    return this.findById(saved.id);
  }

  async delete(id: string): Promise<{ message: string }> {
    const group = await this.countryGroupRepository.findOne({ where: { id } });
    if (!group) {
      throw new NotFoundException(`Country Group with id ${id} not found`);
    }

    try {
      await this.countryGroupRepository.remove(group);
      return { message: `Country Group with id ${id} deleted successfully` };
    } catch (error) {
      if (error.code === "23503") {
        throw new ConflictException(
          "Cannot delete Country Group because it is mapped to one or more Countries",
        );
      }
      throw error;
    }
  }
}
