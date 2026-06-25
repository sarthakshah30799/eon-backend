import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Session } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiParam } from '@nestjs/swagger';
import { BranchService } from './branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { BranchResponseDto } from './dto/branch-response.dto';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@ApiTags('branches')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller('branches')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Get()
  @ApiOperation({ summary: 'Get all branches' })
  @ApiResponse({ status: 200, description: 'List of branches', type: [BranchResponseDto] })
  async findAll(@Query('activeOnly') activeOnly = 'true'): Promise<BranchResponseDto[]> {
    return this.branchService.findAll(activeOnly !== 'false');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get branch by ID' })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Branch details', type: BranchResponseDto })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  async findById(@Param('id') id: string): Promise<BranchResponseDto> {
    return this.branchService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new branch' })
  @ApiResponse({ status: 201, description: 'Branch created', type: BranchResponseDto })
  async create(@Body() dto: CreateBranchDto, @Session() session: any): Promise<BranchResponseDto> {
    return this.branchService.create(dto, session.userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a branch' })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Branch updated', type: BranchResponseDto })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
    @Session() session: any,
  ): Promise<BranchResponseDto> {
    return this.branchService.update(id, dto, session.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a branch' })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Branch deleted' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  async delete(@Param('id') id: string): Promise<{ message: string }> {
    return this.branchService.delete(id);
  }
}
