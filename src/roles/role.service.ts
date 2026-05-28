import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleResponseDto } from './dto/role-response.dto';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async findAll(): Promise<RoleResponseDto[]> {
    const roles = await this.roleRepository.find({
      order: { createdAt: 'DESC' },
    });
    return roles.map(RoleResponseDto.fromEntity);
  }

  async findById(id: string): Promise<RoleResponseDto> {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role with id ${id} not found`);
    }
    return RoleResponseDto.fromEntity(role);
  }

  async create(dto: CreateRoleDto, userId: string): Promise<RoleResponseDto> {
    const existing = await this.roleRepository.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Role with code "${dto.code}" already exists`);
    }
    const role = this.roleRepository.create({
      ...dto,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.roleRepository.save(role);
    return RoleResponseDto.fromEntity(saved);
  }

  async update(id: string, dto: UpdateRoleDto, userId: string): Promise<RoleResponseDto> {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role with id ${id} not found`);
    }
    if (dto.code && dto.code !== role.code) {
      const existing = await this.roleRepository.findOne({ where: { code: dto.code } });
      if (existing) {
        throw new ConflictException(`Role with code "${dto.code}" already exists`);
      }
    }
    Object.assign(role, dto);
    role.updatedBy = userId;
    const saved = await this.roleRepository.save(role);
    return RoleResponseDto.fromEntity(saved);
  }

  async delete(id: string): Promise<{ message: string }> {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role with id ${id} not found`);
    }
    await this.roleRepository.remove(role);
    return { message: `Role with id ${id} deleted successfully` };
  }
}
