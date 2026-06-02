import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './branch.entity';
import { Counter } from '../counters/counter.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
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
  ) {}

  async findAll(): Promise<BranchResponseDto[]> {
    const branches = await this.branchRepository.find({
      relations: ['company', 'counters'],
      order: { createdAt: 'DESC' },
    });
    return branches.map(BranchResponseDto.fromEntity);
  }

  async findById(id: string): Promise<BranchResponseDto> {
    const branch = await this.branchRepository.findOne({
      where: { id },
      relations: ['company', 'counters'],
    });
    if (!branch) {
      throw new NotFoundException(`Branch with id ${id} not found`);
    }
    return BranchResponseDto.fromEntity(branch);
  }

  async create(dto: CreateBranchDto, userId: string): Promise<BranchResponseDto> {
    const { companyId, counterIds, ...rest } = uppercaseFields(dto);
    const branch = this.branchRepository.create({
      ...rest,
      company: companyId ? { id: companyId } as any : null,
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
      relations: ['counters'],
    });
    if (!branch) {
      throw new NotFoundException(`Branch with id ${id} not found`);
    }
    const { companyId, counterIds, ...rest } = uppercaseFields(dto);
    Object.assign(branch, rest);
    if (companyId !== undefined) {
      branch.company = companyId ? { id: companyId } as any : null;
    }
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
