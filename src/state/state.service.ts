import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { Country } from "../country/country.entity";
import { State } from "./state.entity";
import { CreateStateDto } from "./dto/create-state.dto";
import { UpdateStateDto } from "./dto/update-state.dto";
import { StateResponseDto } from "./dto/state-response.dto";
import { StateListQueryDto } from "./dto/state-list-query.dto";
import { StateListResponseDto } from "./dto/state-list-response.dto";

function normalizeStateDto(dto: CreateStateDto | UpdateStateDto) {
  return {
    ...dto,
    code: dto.code?.trim().toUpperCase(),
    name: dto.name?.trim(),
    gstStateCode: dto.gstStateCode?.trim()?.toUpperCase(),
    ctrStateCode: dto.ctrStateCode?.trim()?.toUpperCase(),
  };
}

function pickDefinedFields<T extends Record<string, any>>(value: T): Partial<T> {
  const entries = Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined);
  return Object.fromEntries(entries) as Partial<T>;
}

@Injectable()
export class StateService {
  constructor(
    @InjectRepository(State)
    private readonly stateRepository: Repository<State>,
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
  ) {}

  async create(dto: CreateStateDto, userId: string): Promise<StateResponseDto> {
    const normalized = normalizeStateDto(dto);
    const country = await this.countryRepository.findOne({
      where: { id: normalized.countryId },
    });

    if (!country) {
      throw new NotFoundException(`Country with id ${normalized.countryId} not found`);
    }

    const existingState = await this.stateRepository.findOne({
      where: {
        country: { id: country.id },
        code: normalized.code,
      },
      relations: ["country"],
    });

    if (existingState) {
      throw new ConflictException("State with this code already exists for this country");
    }

    const existingName = await this.stateRepository.findOne({
      where: {
        country: { id: country.id },
        name: normalized.name,
      },
      relations: ["country"],
    });

    if (existingName) {
      throw new ConflictException("State with this name already exists for this country");
    }

    const state = this.stateRepository.create({
      ...normalized,
      country,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.stateRepository.save(state);
    return this.findById(saved.id);
  }

  async update(id: string, dto: UpdateStateDto, userId: string): Promise<StateResponseDto> {
    const state = await this.stateRepository.findOne({
      where: { id },
      relations: ["country"],
    });

    if (!state) {
      throw new NotFoundException(`State with id ${id} not found`);
    }

    const normalized = normalizeStateDto(dto);
    let country = state.country;

    if (normalized.countryId && normalized.countryId !== state.country?.id) {
      const nextCountry = await this.countryRepository.findOne({
        where: { id: normalized.countryId },
      });

      if (!nextCountry) {
        throw new NotFoundException(`Country with id ${normalized.countryId} not found`);
      }

      country = nextCountry;
    }

    const { code: _code, ...updatableFields } = normalized;
    const candidateCode = state.code;
    const candidateName = normalized.name ?? state.name;

    if (country.id !== state.country?.id) {
      const existingState = await this.stateRepository.findOne({
        where: {
          country: { id: country.id },
          code: candidateCode,
        },
        relations: ["country"],
      });

      if (existingState && existingState.id !== state.id) {
        throw new ConflictException("State with this code already exists for this country");
      }
    }

    if (candidateName !== state.name || country.id !== state.country?.id) {
      const existingState = await this.stateRepository.findOne({
        where: {
          country: { id: country.id },
          name: candidateName,
        },
        relations: ["country"],
      });

      if (existingState && existingState.id !== state.id) {
        throw new ConflictException("State with this name already exists for this country");
      }
    }

    const updates = pickDefinedFields({
      ...updatableFields,
      country,
    });

    Object.assign(state, updates);
    state.updatedBy = userId;

    const saved = await this.stateRepository.save(state);
    return this.findById(saved.id);
  }

  async findById(id: string): Promise<StateResponseDto> {
    const state = await this.stateRepository.findOne({
      where: { id },
      relations: ["country"],
    });

    if (!state) {
      throw new NotFoundException(`State with id ${id} not found`);
    }

    return StateResponseDto.fromEntity(state);
  }

  async findAll(query: StateListQueryDto): Promise<StateListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const qb = this.stateRepository.createQueryBuilder("state")
      .leftJoinAndSelect("state.country", "country");

    if (query.search) {
      qb.andWhere(
        new Brackets((searchQb) => {
          searchQb
            .where("state.code ILIKE :search", { search: `%${query.search}%` })
            .orWhere("state.name ILIKE :search", { search: `%${query.search}%` })
            .orWhere("state.gstStateCode ILIKE :search", { search: `%${query.search}%` })
            .orWhere("state.ctrStateCode ILIKE :search", { search: `%${query.search}%` })
            .orWhere("country.code ILIKE :search", { search: `%${query.search}%` })
            .orWhere("country.name ILIKE :search", { search: `%${query.search}%` });
        }),
      );
    }

    if (query.countryId) {
      qb.andWhere("country.id = :countryId", { countryId: query.countryId });
    }

    if (query.code) {
      qb.andWhere("state.code ILIKE :code", { code: `%${query.code}%` });
    }

    if (query.name) {
      qb.andWhere("state.name ILIKE :name", { name: `%${query.name}%` });
    }

    if (query.gstStateCode) {
      qb.andWhere("state.gstStateCode ILIKE :gstStateCode", {
        gstStateCode: `%${query.gstStateCode}%`,
      });
    }

    if (query.ctrStateCode) {
      qb.andWhere("state.ctrStateCode ILIKE :ctrStateCode", {
        ctrStateCode: `%${query.ctrStateCode}%`,
      });
    }

    qb.orderBy("state.createdAt", "DESC").skip(skip).take(limit);

    const [states, totalItems] = await qb.getManyAndCount();

    return {
      data: states.map(StateResponseDto.fromEntity),
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    };
  }
}
