import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { CorporateClient } from "../corporate-clients/corporate-client.entity";
import { Branch } from "../branches/branch.entity";
import { State } from "../state/state.entity";
import { CreateCorporateClientDto } from "../corporate-clients/dto/create-corporate-client.dto";
import { UpdateCorporateClientDto } from "../corporate-clients/dto/update-corporate-client.dto";
import { CorporateClientResponseDto } from "../corporate-clients/dto/corporate-client-response.dto";
import { CorporateClientListQueryDto } from "../corporate-clients/dto/corporate-client-list-query.dto";
import { CorporateClientListResponseDto } from "../corporate-clients/dto/corporate-client-list-response.dto";

function normalizeDto(dto: CreateCorporateClientDto | UpdateCorporateClientDto) {
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
export class FfmcClientService {
  constructor(
    @InjectRepository(CorporateClient)
    private readonly repo: Repository<CorporateClient>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(State)
    private readonly stateRepository: Repository<State>,
  ) {}

  async create(dto: CreateCorporateClientDto, userId: string): Promise<CorporateClientResponseDto> {
    const normalized = normalizeDto(dto);

    const existingCode = await this.repo.findOne({ where: { code: normalized.code } });
    if (existingCode) {
      throw new ConflictException(`FFMC Client Code "${normalized.code}" already exists`);
    }

    const existingName = await this.repo.findOne({ where: { name: normalized.name } });
    if (existingName) {
      throw new ConflictException(`FFMC Client Name "${normalized.name}" already exists`);
    }

    if (dto.originBranchId) {
      const branch = await this.branchRepository.findOne({ where: { id: dto.originBranchId } });
      if (!branch) throw new NotFoundException(`Origin Branch with id ${dto.originBranchId} not found`);
    }

    if (dto.gstStateId) {
      const state = await this.stateRepository.findOne({ where: { id: dto.gstStateId } });
      if (!state) throw new NotFoundException(`GST State with id ${dto.gstStateId} not found`);
    }

    const client = this.repo.create({
      ...normalized,
      isFfmc: true,   // <-- discriminator
      dateOfIntro: normalized.dateOfIntro ? new Date(normalized.dateOfIntro) : new Date(),
      blockDateFrom: normalized.blockDateFrom ? new Date(normalized.blockDateFrom) : null,
      establishmentDate: normalized.establishmentDate ? new Date(normalized.establishmentDate) : null,
      panDob: normalized.panDob ? new Date(normalized.panDob) : null,
      ffmcRegDate: normalized.ffmcRegDate ? new Date(normalized.ffmcRegDate) : null,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.repo.save(client);
    return this.findById(saved.id);
  }

  async update(id: string, dto: UpdateCorporateClientDto, userId: string): Promise<CorporateClientResponseDto> {
    const client = await this.repo.findOne({ where: { id, isFfmc: true } });
    if (!client) throw new NotFoundException(`FFMC Client with id ${id} not found`);

    const normalized = normalizeDto(dto);

    if (normalized.code && normalized.code !== client.code) {
      const existing = await this.repo.findOne({ where: { code: normalized.code } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`FFMC Client Code "${normalized.code}" already exists`);
      }
    }

    if (normalized.name && normalized.name !== client.name) {
      const existing = await this.repo.findOne({ where: { name: normalized.name } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`FFMC Client Name "${normalized.name}" already exists`);
      }
    }

    if (dto.originBranchId && dto.originBranchId !== client.originBranchId) {
      const branch = await this.branchRepository.findOne({ where: { id: dto.originBranchId } });
      if (!branch) throw new NotFoundException(`Origin Branch with id ${dto.originBranchId} not found`);
    }

    if (dto.gstStateId && dto.gstStateId !== client.gstStateId) {
      const state = await this.stateRepository.findOne({ where: { id: dto.gstStateId } });
      if (!state) throw new NotFoundException(`GST State with id ${dto.gstStateId} not found`);
    }

    const updates = pickDefinedFields(normalized);
    Object.assign(client, {
      ...updates,
      isFfmc: true, // always keep true
      dateOfIntro: normalized.dateOfIntro ? new Date(normalized.dateOfIntro) : client.dateOfIntro,
      blockDateFrom: normalized.blockDateFrom !== undefined ? (normalized.blockDateFrom ? new Date(normalized.blockDateFrom) : null) : client.blockDateFrom,
      establishmentDate: normalized.establishmentDate !== undefined ? (normalized.establishmentDate ? new Date(normalized.establishmentDate) : null) : client.establishmentDate,
      panDob: normalized.panDob !== undefined ? (normalized.panDob ? new Date(normalized.panDob) : null) : client.panDob,
      ffmcRegDate: normalized.ffmcRegDate !== undefined ? (normalized.ffmcRegDate ? new Date(normalized.ffmcRegDate) : null) : client.ffmcRegDate,
    });
    client.updatedBy = userId;

    await this.repo.save(client);
    return this.findById(id);
  }

  async findById(id: string): Promise<CorporateClientResponseDto> {
    const client = await this.repo.findOne({
      where: { id, isFfmc: true },
      relations: ["gstState", "originBranch"],
    });
    if (!client) throw new NotFoundException(`FFMC Client with id ${id} not found`);
    return CorporateClientResponseDto.fromEntity(client);
  }

  async delete(id: string): Promise<{ message: string }> {
    const client = await this.repo.findOne({ where: { id, isFfmc: true } });
    if (!client) throw new NotFoundException(`FFMC Client with id ${id} not found`);
    await this.repo.remove(client);
    return { message: `FFMC Client with id ${id} deleted successfully` };
  }

  async findAll(query: CorporateClientListQueryDto): Promise<CorporateClientListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const qb = this.repo.createQueryBuilder("cc")
      .leftJoinAndSelect("cc.gstState", "gstState")
      .leftJoinAndSelect("cc.originBranch", "originBranch")
      .where("cc.isFfmc = :isFfmc", { isFfmc: true });

    if (query.search) {
      qb.andWhere(
        new Brackets(searchQb => {
          searchQb
            .where("cc.code ILIKE :search", { search: `%${query.search}%` })
            .orWhere("cc.name ILIKE :search", { search: `%${query.search}%` })
            .orWhere("cc.city ILIKE :search", { search: `%${query.search}%` });
        }),
      );
    }

    if (query.code) qb.andWhere("cc.code ILIKE :code", { code: `%${query.code}%` });
    if (query.name) qb.andWhere("cc.name ILIKE :name", { name: `%${query.name}%` });
    if (query.active !== undefined) qb.andWhere("cc.active = :active", { active: query.active });

    qb.orderBy("cc.createdAt", "DESC").skip(skip).take(limit);

    const [data, totalItems] = await qb.getManyAndCount();

    return {
      data: data.map(CorporateClientResponseDto.fromEntity),
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    };
  }
}
