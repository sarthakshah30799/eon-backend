import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TdsProfile } from './tds-profile.entity';
import { CreateTdsProfileDto } from './dto/create-tds-profile.dto';
import { UpdateTdsProfileDto } from './dto/update-tds-profile.dto';
import { TdsProfileResponseDto } from './dto/tds-profile-response.dto';

@Injectable()
export class TdsProfileService {
  constructor(
    @InjectRepository(TdsProfile)
    private readonly tdsProfileRepository: Repository<TdsProfile>,
  ) {}

  async findAll(): Promise<TdsProfileResponseDto[]> {
    const profiles = await this.tdsProfileRepository.find({
      order: {
        sortOrder: 'ASC',
        code: 'ASC',
      },
    });

    return profiles.map(TdsProfileResponseDto.fromEntity);
  }

  async findById(id: string): Promise<TdsProfileResponseDto> {
    const profile = await this.tdsProfileRepository.findOne({
      where: { id },
    });

    if (!profile) {
      throw new NotFoundException(`TDS profile with id ${id} not found`);
    }

    return TdsProfileResponseDto.fromEntity(profile);
  }

  async create(
    dto: CreateTdsProfileDto,
    userId: string,
  ): Promise<TdsProfileResponseDto> {
    const code = dto.code.trim().toUpperCase();
    await this.ensureCodeIsUnique(code);
    this.ensureValidDateRange(dto.from, dto.to);

    const profile = this.tdsProfileRepository.create({
      code,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      active: dto.active ?? true,
      sortOrder: dto.sortOrder ?? 0,
      from: dto.from ? new Date(dto.from) : null,
      to: dto.to ? new Date(dto.to) : null,
      value: dto.value,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.tdsProfileRepository.save(profile);
    return this.findById(saved.id);
  }

  async update(
    id: string,
    dto: UpdateTdsProfileDto,
    userId: string,
  ): Promise<TdsProfileResponseDto> {
    const profile = await this.tdsProfileRepository.findOne({
      where: { id },
    });

    if (!profile) {
      throw new NotFoundException(`TDS profile with id ${id} not found`);
    }

    const { code: _code, ...updatableFields } = dto;

    if (updatableFields.name !== undefined) {
      profile.name = updatableFields.name.trim();
    }

    if (updatableFields.description !== undefined) {
      profile.description = updatableFields.description?.trim() || null;
    }

    if (updatableFields.active !== undefined) {
      profile.active = updatableFields.active;
    }

    if (updatableFields.sortOrder !== undefined) {
      profile.sortOrder = updatableFields.sortOrder;
    }

    if (updatableFields.from !== undefined || updatableFields.to !== undefined) {
      const nextFrom =
        updatableFields.from !== undefined
          ? (updatableFields.from ? new Date(updatableFields.from) : null)
          : profile.from;
      const nextTo =
        updatableFields.to !== undefined
          ? (updatableFields.to ? new Date(updatableFields.to) : null)
          : profile.to;
      this.ensureValidDateRange(
        nextFrom ? nextFrom.toISOString() : null,
        nextTo ? nextTo.toISOString() : null,
      );
      profile.from = nextFrom;
      profile.to = nextTo;
    }

    if (updatableFields.value !== undefined) {
      profile.value = updatableFields.value;
    }

    profile.updatedBy = userId;
    this.ensureValidDateRange(
      profile.from ? profile.from.toISOString() : null,
      profile.to ? profile.to.toISOString() : null,
    );

    await this.tdsProfileRepository.save(profile);
    return this.findById(id);
  }

  async delete(id: string): Promise<{ message: string }> {
    const profile = await this.tdsProfileRepository.findOne({ where: { id } });

    if (!profile) {
      throw new NotFoundException(`TDS profile with id ${id} not found`);
    }

    await this.tdsProfileRepository.remove(profile);
    return { message: `TDS profile with id ${id} deleted successfully` };
  }

  private async ensureCodeIsUnique(code: string, excludeId?: string) {
    const existing = await this.tdsProfileRepository.findOne({
      where: { code },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`TDS profile with code "${code}" already exists`);
    }
  }

  private ensureValidDateRange(from?: string | null, to?: string | null) {
    if (!from || !to) {
      return;
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid TDS date range');
    }

    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('"from" date cannot be later than "to" date');
    }
  }
}
