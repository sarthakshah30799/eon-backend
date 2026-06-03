import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Session } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiParam } from '@nestjs/swagger';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleResponseDto } from './dto/role-response.dto';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@ApiTags('roles')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @ApiOperation({ summary: 'Get all roles' })
  @ApiResponse({ status: 200, description: 'List of roles', type: [RoleResponseDto] })
  async findAll(@Session() session: any): Promise<RoleResponseDto[]> {
    return this.roleService.findAll(session.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get role by ID' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Role details', type: RoleResponseDto })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async findById(@Param('id') id: string, @Session() session: any): Promise<RoleResponseDto> {
    return this.roleService.findById(id, session.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new role' })
  @ApiResponse({ status: 201, description: 'Role created', type: RoleResponseDto })
  @ApiResponse({ status: 409, description: 'Role code already exists' })
  async create(@Body() dto: CreateRoleDto, @Session() session: any): Promise<RoleResponseDto> {
    return this.roleService.create(dto, session.userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a role' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Role updated', type: RoleResponseDto })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @Session() session: any,
  ): Promise<RoleResponseDto> {
    return this.roleService.update(id, dto, session.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a role' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Role deleted' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async delete(@Param('id') id: string, @Session() session: any): Promise<{ message: string }> {
    return this.roleService.delete(id);
  }

  @Get(':id/permissions')
  @ApiOperation({ summary: 'Get permissions matrix for a role' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Permissions matrix' })
  async getPermissions(@Param('id') id: string, @Session() session: any) {
    return this.roleService.getRolePermissions(id, session.userId);
  }

  @Post(':id/permissions')
  @ApiOperation({ summary: 'Update permissions matrix for a role' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Success message' })
  async updatePermissions(
    @Param('id') id: string,
    @Body() body: Record<string, Record<string, boolean>>,
    @Session() session: any,
  ) {
    return this.roleService.updateRolePermissions(id, body, session.userId);
  }
}
