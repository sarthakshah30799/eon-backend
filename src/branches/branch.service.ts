import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Branch } from './branch.entity';
import { Counter } from '../counters/counter.entity';
import { Country } from '../country/country.entity';
import { State } from '../state/state.entity';
import { SelectOption } from '../category-options/category-option.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { BranchListQueryDto } from './dto/branch-list-query.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { BranchResponseDto } from './dto/branch-response.dto';

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
  ) {}

  async findAll(query?: BranchListQueryDto): Promise<BranchResponseDto[]> {
    const includeInactive = query?.activeOnly === false;
    const qb = this.branchRepository
      .createQueryBuilder('branch')
      .leftJoinAndSelect('branch.company', 'company')
      .leftJoinAndSelect('branch.counters', 'counters')
      .leftJoinAndSelect('branch.country', 'country')
      .leftJoinAndSelect('branch.state', 'state')
      .leftJoinAndSelect('branch.locationType', 'locationType')
      .orderBy('branch.createdAt', 'DESC');

    if (!includeInactive) {
      qb.andWhere('branch.isActive = :isActive', { isActive: true });
    }

    if (query?.search) {
      qb.andWhere(
        new Brackets(searchQb => {
          searchQb
            .where('branch.code ILIKE :search', { search: `%${query.search}%` })
            .orWhere('branch.name ILIKE :search', { search: `%${query.search}%` })
            .orWhere('branch.city ILIKE :search', { search: `%${query.search}%` })
            .orWhere('branch.branch_number::text ILIKE :search', { search: `%${query.search}%` })
            .orWhere('branch.contactName ILIKE :search', { search: `%${query.search}%` })
            .orWhere('branch.contactNo ILIKE :search', { search: `%${query.search}%` })
            .orWhere('branch.branchEmail ILIKE :search', { search: `%${query.search}%` })
            .orWhere('country.name ILIKE :search', { search: `%${query.search}%` })
            .orWhere('state.name ILIKE :search', { search: `%${query.search}%` })
            .orWhere('company.name ILIKE :search', { search: `%${query.search}%` });
        })
      );
    }

    const branches = await qb.getMany();
    return branches.map(branch => BranchResponseDto.fromEntity(branch));
  }

  async findById(id: string): Promise<BranchResponseDto> {
    const branch = await this.branchRepository.findOne({
      where: { id },
      relations: ['company', 'counters', 'country', 'state', 'locationType'],
    });
    if (!branch) {
      throw new NotFoundException(`Branch with id ${id} not found`);
    }
    return BranchResponseDto.fromEntity(branch);
  }

  async create(dto: CreateBranchDto, userId: string): Promise<BranchResponseDto> {
    const { companyId, countryId, stateId, counterIds, locationType, ...rest } = uppercaseFields(dto);

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
      locationType: locationType ? ({ id: locationType } as SelectOption) : null,
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
      relations: ['counters', 'company', 'country', 'state', 'locationType'],
    });
    if (!branch) {
      throw new NotFoundException(`Branch with id ${id} not found`);
    }

    const { code: _code, companyId, countryId, stateId, counterIds, locationType, ...rest } = uppercaseFields(dto);

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
    if (locationType !== undefined) {
      branch.locationType = locationType ? ({ id: locationType } as SelectOption) : null;
    }
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
