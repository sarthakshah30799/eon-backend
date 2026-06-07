import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { Country, CountryRiskCategory } from "./country.entity";
import { CreateCountryDto } from "./dto/create-country.dto";
import { UpdateCountryDto } from "./dto/update-country.dto";
import { CountryResponseDto } from "./dto/country-response.dto";
import { CountryListQueryDto } from "./dto/country-list-query.dto";
import { CountryListResponseDto } from "./dto/country-list-response.dto";

function normalizeCountryDto(dto: CreateCountryDto | UpdateCountryDto) {
  return {
    ...dto,
    code: dto.code?.trim().toUpperCase(),
    name: dto.name?.trim(),
    lrsCountryCode: dto.lrsCountryCode?.trim()?.toUpperCase(),
    ctrCountryCode: dto.ctrCountryCode?.trim()?.toUpperCase(),
  };
}

function pickDefinedFields<T extends Record<string, any>>(value: T): Partial<T> {
  const entries = Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined);
  return Object.fromEntries(entries) as Partial<T>;
}

@Injectable()
export class CountryService {
  constructor(
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
  ) {}

  async create(dto: CreateCountryDto, userId: string): Promise<CountryResponseDto> {
    const { countryGroupId, ...normalized } = normalizeCountryDto(dto);

    const existingCountry = await this.countryRepository.findOne({
      where: { code: normalized.code },
    });

    if (existingCountry) {
      throw new ConflictException("Country with this code already exists");
    }

    const country = this.countryRepository.create({
      ...normalized,
      countryGroup: countryGroupId ? ({ id: countryGroupId } as any) : null,
      riskCategory: normalized.riskCategory ?? CountryRiskCategory.Low,
      restrictedCountry: normalized.restrictedCountry ?? false,
      greyListCountry: normalized.greyListCountry ?? false,
      baseCountry: normalized.baseCountry ?? false,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.countryRepository.save(country);
    return this.findById(saved.id);
  }

  async update(id: string, dto: UpdateCountryDto, userId: string): Promise<CountryResponseDto> {
    const country = await this.countryRepository.findOne({ where: { id } });

    if (!country) {
      throw new NotFoundException(`Country with id ${id} not found`);
    }

    const { countryGroupId, ...normalized } = normalizeCountryDto(dto);

    if (normalized.code && normalized.code !== country.code) {
      const existingCountry = await this.countryRepository.findOne({
        where: { code: normalized.code },
      });

      if (existingCountry) {
        throw new ConflictException("Country with this code already exists");
      }
    }

    const updates = pickDefinedFields({
      ...normalized,
      riskCategory: normalized.riskCategory ?? country.riskCategory,
    });
    Object.assign(country, updates);

    if (countryGroupId !== undefined) {
      country.countryGroup = countryGroupId ? ({ id: countryGroupId } as any) : null;
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

  async findAll(query: CountryListQueryDto): Promise<CountryListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const qb = this.countryRepository.createQueryBuilder("country").leftJoinAndSelect("country.countryGroup", "countryGroup");

    if (query.search) {
      qb.andWhere(
        new Brackets((searchQb) => {
          searchQb
            .where("country.code ILIKE :search", { search: `%${query.search}%` })
            .orWhere("country.name ILIKE :search", { search: `%${query.search}%` })
            .orWhere("country.lrsCountryCode ILIKE :search", { search: `%${query.search}%` })
            .orWhere("country.ctrCountryCode ILIKE :search", { search: `%${query.search}%` });
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
      qb.andWhere("country.riskCategory = :riskCategory", { riskCategory: query.riskCategory });
    }

    if (query.restrictedCountry !== undefined) {
      qb.andWhere("country.restrictedCountry = :restrictedCountry", {
        restrictedCountry: query.restrictedCountry,
      });
    }

    if (query.greyListCountry !== undefined) {
      qb.andWhere("country.greyListCountry = :greyListCountry", {
        greyListCountry: query.greyListCountry,
      });
    }

    if (query.baseCountry !== undefined) {
      qb.andWhere("country.baseCountry = :baseCountry", {
        baseCountry: query.baseCountry,
      });
    }

    qb.orderBy("country.createdAt", "DESC").skip(skip).take(limit);

    const [countries, totalItems] = await qb.getManyAndCount();

    return {
      data: countries.map(CountryResponseDto.fromEntity),
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    };
  }
}
