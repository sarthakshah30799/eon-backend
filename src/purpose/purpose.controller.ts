import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  Session,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UserService } from '../users/user.service';
import { PurposeService } from './purpose.service';
import { CreatePurposeDto } from './dto/create-purpose.dto';
import { UpdatePurposeDto } from './dto/update-purpose.dto';
import { PurposeResponseDto } from './dto/purpose-response.dto';
import { PurposeListQueryDto } from './dto/purpose-list-query.dto';

@ApiTags('purposes')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller('purposes')
export class PurposeController {
  constructor(
    private readonly purposeService: PurposeService,
    private readonly userService: UserService,
  ) {}

  private async assertAdminOrHoStaff(session: { userId?: string; activeBranchId?: string | null; activeCounterId?: string | null }) {
    if (!session.userId) {
      throw new BadRequestException('User session is missing');
    }

    const user = await this.userService.findById(session.userId, session.userId, {
      activeBranchId: session.activeBranchId ?? null,
      activeCounterId: session.activeCounterId ?? null,
    });

    if (!(user.isAdmin || user.isHoStaff)) {
      throw new ForbiddenException('Only admin or HO staff can manage purposes');
    }

    return user;
  }

  @Get()
  @ApiOperation({ summary: 'Get all purposes' })
  @ApiResponse({ status: 200, type: [PurposeResponseDto] })
  async findAll(
    @Query() query: PurposeListQueryDto,
  ): Promise<PurposeResponseDto[]> {
    return this.purposeService.findAll(query);
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Get purpose by code' })
  @ApiParam({ name: 'code', description: 'Purpose code' })
  async findByCode(
    @Param('code') code: string,
  ): Promise<PurposeResponseDto> {
    return this.purposeService.findByCode(code);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get purpose by ID' })
  @ApiParam({ name: 'id', description: 'Purpose UUID' })
  @ApiResponse({ status: 200, type: PurposeResponseDto })
  async findById(
    @Param('id') id: string,
  ): Promise<PurposeResponseDto> {
    return this.purposeService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a purpose' })
  async create(
    @Body() dto: CreatePurposeDto,
    @Session() session: { userId?: string; activeBranchId?: string | null; activeCounterId?: string | null },
  ): Promise<PurposeResponseDto> {
    const user = await this.assertAdminOrHoStaff(session);
    return this.purposeService.create(dto, user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a purpose' })
  @ApiParam({ name: 'id', description: 'Purpose UUID' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePurposeDto,
    @Session() session: { userId?: string; activeBranchId?: string | null; activeCounterId?: string | null },
  ): Promise<PurposeResponseDto> {
    const user = await this.assertAdminOrHoStaff(session);
    return this.purposeService.update(id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a purpose' })
  @ApiParam({ name: 'id', description: 'Purpose UUID' })
  async delete(
    @Param('id') id: string,
    @Session() session: { userId?: string; activeBranchId?: string | null; activeCounterId?: string | null },
  ): Promise<{ message: string }> {
    const user = await this.assertAdminOrHoStaff(session);
    return this.purposeService.delete(id, user.id);
  }
}
