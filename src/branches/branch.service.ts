import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './branch.entity';
import { Counter } from '../counters/counter.entity';
import { Country } from '../country/country.entity';
import { State } from '../state/state.entity';
import { SelectOption } from '../category-options/category-option.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { BranchResponseDto } from './dto/branch-response.dto';
import { SelectOptionResponseDto } from '../category-options/dto/category-option-response.dto';

import { uppercaseFields } from '../utils/uppercase.util';

@Injectable()
export class BranchService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Counter)
    private readonly counterRepository: Repository<Counter>,
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
    @InjectRepository(State)
    private readonly stateRepository: Repository<State>,
    @InjectRepository(SelectOption)
    private readonly selectOptionRepository: Repository<SelectOption>,
  ) {}

  private normalizeComparableValue(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private async getLocationTypeLookup(): Promise<
    Map<string, SelectOptionResponseDto>
  > {
    const options = await this.selectOptionRepository.find({
      where: { code: 'locationType' },
      order: { sortOrder: 'ASC', label: 'ASC' },
    });

    const lookup = new Map<string, SelectOptionResponseDto>();

    options.forEach(option => {
      const response = SelectOptionResponseDto.fromEntity(option);
      lookup.set(this.normalizeComparableValue(option.id), response);
      lookup.set(this.normalizeComparableValue(option.value), response);
      lookup.set(this.normalizeComparableValue(option.label), response);
    });

    return lookup;
  }

  private toResponseDto(
    branch: Branch,
    locationTypeLookup: Map<string, SelectOptionResponseDto>,
  ): BranchResponseDto {
    const locationTypeOption = locationTypeLookup.get(
      this.normalizeComparableValue(branch.locationType),
    );

    return BranchResponseDto.fromEntity(branch, locationTypeOption ?? null);
  }

  async findAll(): Promise<BranchResponseDto[]> {
    const branches = await this.branchRepository.find({
      relations: ['company', 'counters', 'country', 'state'],
      order: { createdAt: 'DESC' },
    });
    const locationTypeLookup = await this.getLocationTypeLookup();
    return branches.map(branch => this.toResponseDto(branch, locationTypeLookup));
  }

  async findById(id: string): Promise<BranchResponseDto> {
    const branch = await this.branchRepository.findOne({
      where: { id },
      relations: ['company', 'counters', 'country', 'state'],
    });
    if (!branch) {
      throw new NotFoundException(`Branch with id ${id} not found`);
    }
    const locationTypeLookup = await this.getLocationTypeLookup();
    return this.toResponseDto(branch, locationTypeLookup);
  }

  async create(dto: CreateBranchDto, userId: string): Promise<BranchResponseDto> {
    const { companyId, countryId, stateId, counterIds, ...rest } = uppercaseFields(dto);

    const country = await this.countryRepository.findOne({
      where: { id: countryId },
    });

    if (!country) {
      throw new NotFoundException(`Country with id ${countryId} not found`);
    }

    const state = await this.stateRepository.findOne({
      where: { id: stateId },
      relations: ['country'],
    });

    if (!state) {
      throw new NotFoundException(`State with id ${stateId} not found`);
    }

    if (state.country?.id !== country.id) {
      throw new NotFoundException('Selected state does not belong to the selected country');
    }

    const branch = this.branchRepository.create({
      ...rest,
      country,
      state,
      company: companyId ? ({ id: companyId } as any) : null,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.branchRepository.save(branch);

    if (counterIds && counterIds.length > 0) {
      for (const counterId of counterIds) {
        await this.counterRepository.update(counterId, {
          branch: { id: saved.id } as any,
          updatedBy: userId,
        });
      }
    }

    return this.findById(saved.id);
  }

  async update(id: string, dto: UpdateBranchDto, userId: string): Promise<BranchResponseDto> {
    const branch = await this.branchRepository.findOne({
      where: { id },
      relations: ['counters', 'company', 'country', 'state'],
    });
    if (!branch) {
      throw new NotFoundException(`Branch with id ${id} not found`);
    }

    const { code: _code, companyId, countryId, stateId, counterIds, ...rest } = uppercaseFields(dto);

    let country = branch.country;
    let state = branch.state;

    if (countryId !== undefined) {
      const nextCountry = await this.countryRepository.findOne({
        where: { id: countryId },
      });

      if (!nextCountry) {
        throw new NotFoundException(`Country with id ${countryId} not found`);
      }

      country = nextCountry;
    }

    if (stateId !== undefined) {
      const nextState = await this.stateRepository.findOne({
        where: { id: stateId },
        relations: ['country'],
      });

      if (!nextState) {
        throw new NotFoundException(`State with id ${stateId} not found`);
      }

      state = nextState;
    }

    if (!country && state?.country) {
      country = state.country;
    }

    if (country && state && state.country?.id !== country.id) {
      throw new NotFoundException('Selected state does not belong to the selected country');
    }

    Object.assign(branch, rest);
    if (companyId !== undefined) {
      branch.company = companyId ? ({ id: companyId } as any) : null;
    }
    branch.country = country ? ({ id: country.id } as any) : null;
    branch.state = state ? ({ id: state.id } as any) : null;
    branch.updatedBy = userId;
    await this.branchRepository.save(branch);

    if (counterIds !== undefined) {
      // 1. Unlink counters that are no longer linked
      const oldCounterIds = branch.counters ? branch.counters.map(c => c.id) : [];
      const toUnlink = oldCounterIds.filter(cid => !counterIds.includes(cid));
      for (const counterId of toUnlink) {
        await this.counterRepository.update(counterId, {
          branch: null,
          updatedBy: userId,
        });
      }

      // 2. Link the new counters
      for (const counterId of counterIds) {
        await this.counterRepository.update(counterId, {
          branch: { id: branch.id } as any,
          updatedBy: userId,
        });
      }
    }

    return this.findById(id);
  }

  async delete(id: string): Promise<{ message: string }> {
    const branch = await this.branchRepository.findOne({ where: { id } });
    if (!branch) {
      throw new NotFoundException(`Branch with id ${id} not found`);
    }
    await this.branchRepository.remove(branch);
    return { message: `Branch with id ${id} deleted successfully` };
  }
}
