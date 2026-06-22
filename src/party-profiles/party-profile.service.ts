import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { PartyProfile, ClientType } from "./party-profile.entity";
import { Branch } from "../branches/branch.entity";
import { State } from "../state/state.entity";
import { CreatePartyProfileDto } from "./dto/create-party-profile.dto";
import { UpdatePartyProfileDto } from "./dto/update-party-profile.dto";
import { PartyProfileResponseDto } from "./dto/party-profile-response.dto";
import { PartyProfileListQueryDto } from "./dto/party-profile-list-query.dto";
import { PartyProfileListResponseDto } from "./dto/party-profile-list-response.dto";

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
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(State)
    private readonly stateRepository: Repository<State>,
  ) {}

  getTypes() {
    return [
      { value: ClientType.CORPORATE_CLIENT, label: 'CORPORATE CLIENT' },
      { value: ClientType.FFMC, label: 'FFMC' },
      { value: ClientType.AUTHORISED_DEALER, label: 'AUTHORISED DEALER' },
      { value: ClientType.RMC, label: 'RMC' },
      { value: ClientType.FRANCHISE, label: 'FRANCHISE' },
      { value: ClientType.AGENT, label: 'AGENT' },
      { value: ClientType.FOREIGN_CORRESPONDENT, label: 'FOREIGN CORRESPONDENT' },
      { value: ClientType.MARKETING_EXECUTIVE, label: 'MARKETING EXECUTIVE' },
      { value: ClientType.CARD_ISSUER_PROFILE, label: 'CARD ISSUER PROFILE' },
      { value: ClientType.MISC_PROFILE, label: 'MISC PROFILE' }
    ];
  }

  async create(dto: CreatePartyProfileDto, userId: string): Promise<PartyProfileResponseDto> {
    const normalized = normalizeDto(dto);

    // Validate Code uniqueness
    const existingCode = await this.partyProfileRepository.findOne({
      where: { code: normalized.code },
    });
    if (existingCode) {
      throw new ConflictException(`Party Profile Code "${normalized.code}" already exists`);
    }

    // Validate Name uniqueness
    const existingName = await this.partyProfileRepository.findOne({
      where: { name: normalized.name },
    });
    if (existingName) {
      throw new ConflictException(`Party Profile Name "${normalized.name}" already exists`);
    }

    // Validate Origin Branch exists if provided
    if (dto.originBranchId) {
      const branch = await this.branchRepository.findOne({ where: { id: dto.originBranchId } });
      if (!branch) {
        throw new NotFoundException(`Origin Branch with id ${dto.originBranchId} not found`);
      }
    }

    // Validate GST State exists if provided
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

    // Validate Code uniqueness if changing
    if (normalized.code && normalized.code !== client.code) {
      const existingCode = await this.partyProfileRepository.findOne({
        where: { code: normalized.code },
      });
      if (existingCode) {
        throw new ConflictException(`Party Profile Code "${normalized.code}" already exists`);
      }
    }

    // Validate Name uniqueness if changing
    if (normalized.name && normalized.name !== client.name) {
      const existingName = await this.partyProfileRepository.findOne({
        where: { name: normalized.name },
      });
      if (existingName) {
        throw new ConflictException(`Party Profile Name "${normalized.name}" already exists`);
      }
    }

    // Validate Origin Branch if provided
    if (dto.originBranchId && dto.originBranchId !== client.originBranchId) {
      const branch = await this.branchRepository.findOne({ where: { id: dto.originBranchId } });
      if (!branch) {
        throw new NotFoundException(`Origin Branch with id ${dto.originBranchId} not found`);
      }
    }

    // Validate GST State if provided
    if (dto.gstStateId && dto.gstStateId !== client.gstStateId) {
      const state = await this.stateRepository.findOne({ where: { id: dto.gstStateId } });
      if (!state) {
        throw new NotFoundException(`GST State with id ${dto.gstStateId} not found`);
      }
    }

    const updates = pickDefinedFields(normalized);
    Object.assign(client, {
      ...updates,
      dateOfIntro: normalized.dateOfIntro ? new Date(normalized.dateOfIntro) : client.dateOfIntro,
      blockDateFrom: normalized.blockDateFrom !== undefined ? (normalized.blockDateFrom ? new Date(normalized.blockDateFrom) : null) : client.blockDateFrom,
      establishmentDate: normalized.establishmentDate !== undefined ? (normalized.establishmentDate ? new Date(normalized.establishmentDate) : null) : client.establishmentDate,
      panDob: normalized.panDob !== undefined ? (normalized.panDob ? new Date(normalized.panDob) : null) : client.panDob,
      ffmcRegDate: normalized.ffmcRegDate !== undefined ? (normalized.ffmcRegDate ? new Date(normalized.ffmcRegDate) : null) : client.ffmcRegDate,
    });
    client.updatedBy = userId;

    await this.partyProfileRepository.save(client);
    return this.findById(id);
  }

  async findById(id: string): Promise<PartyProfileResponseDto> {
    const client = await this.partyProfileRepository.findOne({
      where: { id },
      relations: ["gstState", "originBranch"],
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

    const qb = this.partyProfileRepository.createQueryBuilder("pp")
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
