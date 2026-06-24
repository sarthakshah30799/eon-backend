import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Session,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DocumentProfileService } from './document-profile.service';
import { CreateDocumentProfileDto } from './dto/create-document-profile.dto';
import { UpdateDocumentProfileDto } from './dto/update-document-profile.dto';
import { DocumentProfileResponseDto } from './dto/document-profile-response.dto';
import { ResolveDocumentProfilesDto } from './dto/resolve-document-profile-rules.dto';
import { DocumentProfileListQueryDto } from './dto/document-profile-list-query.dto';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@ApiTags('document-profiles')
@ApiCookieAuth('sessionId')
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@Controller('document-profiles')
export class DocumentProfileController {
  constructor(private readonly documentProfileService: DocumentProfileService) {}

  @Get()
  @ApiOperation({ summary: 'List document profiles' })
  @ApiResponse({ status: 200, type: [DocumentProfileResponseDto] })
  async findAll(
    @Query() _query: DocumentProfileListQueryDto,
  ): Promise<DocumentProfileResponseDto[]> {
    return this.documentProfileService.findAll();
  }

  @Get('resolve')
  @ApiOperation({ summary: 'Resolve document profiles' })
  async resolve(
    @Query() query: ResolveDocumentProfilesDto,
  ): Promise<DocumentProfileResponseDto[]> {
    return this.documentProfileService.resolveRules(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document profile by ID' })
  @ApiParam({ name: 'id', description: 'Document profile UUID' })
  async findById(@Param('id') id: string): Promise<DocumentProfileResponseDto> {
    return this.documentProfileService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a document profile' })
  async create(
    @Body() dto: CreateDocumentProfileDto,
    @Session() session: any,
  ): Promise<DocumentProfileResponseDto> {
    return this.documentProfileService.create(dto, session.userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a document profile' })
  @ApiParam({ name: 'id', description: 'Document profile UUID' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentProfileDto,
    @Session() session: any,
  ): Promise<DocumentProfileResponseDto> {
    return this.documentProfileService.update(id, dto, session.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a document profile' })
  @ApiParam({ name: 'id', description: 'Document profile UUID' })
  async delete(@Param('id') id: string): Promise<{ message: string }> {
    return this.documentProfileService.delete(id);
  }
}
