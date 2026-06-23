import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Session,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreateTdsProfileDto } from './dto/create-tds-profile.dto';
import { UpdateTdsProfileDto } from './dto/update-tds-profile.dto';
import { TdsProfileResponseDto } from './dto/tds-profile-response.dto';
import { TdsProfileService } from './tds-profile.service';

@ApiTags('tds-profiles')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller('tds-profiles')
export class TdsProfileController {
  constructor(private readonly tdsProfileService: TdsProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Get all TDS profiles' })
  @ApiResponse({ status: 200, type: [TdsProfileResponseDto] })
  async findAll(): Promise<TdsProfileResponseDto[]> {
    return this.tdsProfileService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get TDS profile by ID' })
  @ApiParam({ name: 'id', description: 'TDS profile UUID' })
  async findById(@Param('id') id: string): Promise<TdsProfileResponseDto> {
    return this.tdsProfileService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a TDS profile' })
  async create(
    @Body() dto: CreateTdsProfileDto,
    @Session() session: any,
  ): Promise<TdsProfileResponseDto> {
    return this.tdsProfileService.create(dto, session.userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a TDS profile' })
  @ApiParam({ name: 'id', description: 'TDS profile UUID' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTdsProfileDto,
    @Session() session: any,
  ): Promise<TdsProfileResponseDto> {
    return this.tdsProfileService.update(id, dto, session.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a TDS profile' })
  @ApiParam({ name: 'id', description: 'TDS profile UUID' })
  async delete(@Param('id') id: string): Promise<{ message: string }> {
    return this.tdsProfileService.delete(id);
  }
}
