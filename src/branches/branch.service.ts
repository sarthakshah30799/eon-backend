import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './branch.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { BranchResponseDto } from './dto/branch-response.dto';

@Injectable()
export class BranchService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
  ) {}

  async findAll(): Promise<BranchResponseDto[]> {
    const branches = await this.branchRepository.find({
      relations: ['company'],
      order: { createdAt: 'DESC' },
    });
    return branches.map(BranchResponseDto.fromEntity);
  }

  async findById(id: string): Promise<BranchResponseDto> {
    const branch = await this.branchRepository.findOne({
      where: { id },
      relations: ['company'],
    });
    if (!branch) {
      throw new NotFoundException(`Branch with id ${id} not found`);
    }
    return BranchResponseDto.fromEntity(branch);
  }

  async create(dto: CreateBranchDto, userId: string): Promise<BranchResponseDto> {
    const { companyId, ...rest } = dto;
    const branch = this.branchRepository.create({
      ...rest,
      company: companyId ? { id: companyId } as any : null,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.branchRepository.save(branch);
    return this.findById(saved.id);
  }

  async update(id: string, dto: UpdateBranchDto, userId: string): Promise<BranchResponseDto> {
    const branch = await this.branchRepository.findOne({ where: { id } });
    if (!branch) {
      throw new NotFoundException(`Branch with id ${id} not found`);
    }
    const { companyId, ...rest } = dto;
    Object.assign(branch, rest);
    if (companyId !== undefined) {
      branch.company = companyId ? { id: companyId } as any : null;
    }
    branch.updatedBy = userId;
    await this.branchRepository.save(branch);
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
