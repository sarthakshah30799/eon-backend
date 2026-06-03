import { Injectable, NotFoundException, ConflictException, OnModuleInit, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './role.entity';
import { User } from '../users/user.entity';
import { Permission } from '../permissions/permission.entity';
import { RolesMenuPermission } from '../roles-menu-permission/roles-menu-permission.entity';
import { Company } from '../company/company.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleResponseDto } from './dto/role-response.dto';

import { uppercaseFields } from '../utils/uppercase.util';

@Injectable()
export class RoleService implements OnModuleInit {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(RolesMenuPermission)
    private readonly menuPermissionRepository: Repository<RolesMenuPermission>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  private async isRequesterAdmin(userId?: string): Promise<boolean> {
    if (!userId) {
      return false;
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    return user?.isAdmin === true;
  }

  async onModuleInit() {
    const requiredPermissions = [
      { code: 'add', name: 'Add', description: 'Permission to add records' },
      { code: 'modify', name: 'Modify', description: 'Permission to modify records' },
      { code: 'delete', name: 'Delete', description: 'Permission to delete records' },
      { code: 'view', name: 'View', description: 'Permission to view records' },
      { code: 'export', name: 'Export', description: 'Permission to export data' },
      { code: 'authorized', name: 'Authorized', description: 'Permission to authorize records' },
      { code: 'rejected', name: 'Rejected', description: 'Permission to reject records' },
    ];
    for (const p of requiredPermissions) {
      try {
        const existing = await this.permissionRepository.findOne({ where: { code: p.code } });
        if (!existing) {
          const newPermission = this.permissionRepository.create({
            code: p.code,
            name: p.name,
            description: p.description,
            createdBy: '00000000-0000-0000-0000-000000000000',
            updatedBy: '00000000-0000-0000-0000-000000000000',
          });
          await this.permissionRepository.save(newPermission);
        }
      } catch (err) {
        console.error(`Failed to seed permission ${p.code}:`, err);
      }
    }
  }

  async getRolePermissions(
    roleId: string,
    currentUserId?: string,
  ): Promise<Record<string, Record<string, boolean>>> {
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role with id ${roleId} not found`);
    }

    if (role.isAdmin && !(await this.isRequesterAdmin(currentUserId))) {
      throw new NotFoundException(`Role with id ${roleId} not found`);
    }

    const relations = await this.menuPermissionRepository.find({
      where: { role: { id: roleId } },
      relations: ['menu', 'permission'],
    });

    const grid: Record<string, Record<string, boolean>> = {};
    for (const item of relations) {
      if (!item.menu || !item.permission) continue;
      const menuId = item.menu.id;
      const permCode = item.permission.code;
      if (!grid[menuId]) {
        grid[menuId] = {
          add: false,
          modify: false,
          delete: false,
          view: false,
          export: false,
          authorized: false,
          rejected: false,
        };
      }
      grid[menuId][permCode] = true;
    }

    return grid;
  }

  async updateRolePermissions(
    roleId: string,
    grid: Record<string, Record<string, boolean>>,
    currentUserId?: string,
  ): Promise<{ message: string }> {
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role with id ${roleId} not found`);
    }

    if (role.isAdmin && !(await this.isRequesterAdmin(currentUserId))) {
      throw new NotFoundException(`Role with id ${roleId} not found`);
    }

    // Delete existing permissions for this role
    await this.menuPermissionRepository.delete({ role: { id: roleId } });

    // Fetch all permissions & menus to link them
    const allPermissions = await this.permissionRepository.find();
    const permissionMap = new Map(allPermissions.map(p => [p.code, p]));

    // Use default company ID
    const company = await this.companyRepository.findOne({ where: {} });
    const companyId = company?.id || '11111111-1111-4111-b111-111111111111';

    const entitiesToSave: RolesMenuPermission[] = [];

    for (const [menuId, perms] of Object.entries(grid)) {
      for (const [permCode, isEnabled] of Object.entries(perms)) {
        if (!isEnabled) continue;
        const permission = permissionMap.get(permCode);
        if (!permission) continue;

        const mp = this.menuPermissionRepository.create({
          role: { id: roleId } as any,
          company: { id: companyId } as any,
          menu: { id: menuId } as any,
          permission: { id: permission.id } as any,
        });
        entitiesToSave.push(mp);
      }
    }

    if (entitiesToSave.length > 0) {
      await this.menuPermissionRepository.save(entitiesToSave);
    }

    return { message: 'Permissions updated successfully' };
  }

  async findAll(currentUserId?: string): Promise<RoleResponseDto[]> {
    const roles = await this.roleRepository.find({
      order: { createdAt: 'DESC' },
    });

    if (await this.isRequesterAdmin(currentUserId)) {
      return roles.map(RoleResponseDto.fromEntity);
    }

    return roles
      .filter(role => role.isAdmin !== true)
      .map(RoleResponseDto.fromEntity);
  }

  async findById(id: string, currentUserId?: string): Promise<RoleResponseDto> {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role with id ${id} not found`);
    }
    if (role.isAdmin && !(await this.isRequesterAdmin(currentUserId))) {
      throw new NotFoundException(`Role with id ${id} not found`);
    }
    return RoleResponseDto.fromEntity(role);
  }

  async create(rawDto: CreateRoleDto, userId: string): Promise<RoleResponseDto> {
    const dto = uppercaseFields(rawDto);
    const requesterIsAdmin = await this.isRequesterAdmin(userId);

    if (dto.isAdmin && !requesterIsAdmin) {
      throw new ForbiddenException('Admin role can only be managed by admin users');
    }

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

  async update(id: string, rawDto: UpdateRoleDto, userId: string): Promise<RoleResponseDto> {
    const dto = uppercaseFields(rawDto);
    const requesterIsAdmin = await this.isRequesterAdmin(userId);
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role with id ${id} not found`);
    }
    if (role.isAdmin && !requesterIsAdmin) {
      throw new NotFoundException(`Role with id ${id} not found`);
    }
    if (dto.isAdmin && !requesterIsAdmin) {
      throw new ForbiddenException('Admin role can only be managed by admin users');
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
    if (role.isAdmin) {
      throw new BadRequestException('Admin role cannot be deleted');
    }
    await this.roleRepository.remove(role);
    return { message: `Role with id ${id} deleted successfully` };
  }
}
