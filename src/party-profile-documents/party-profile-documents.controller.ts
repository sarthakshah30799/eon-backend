import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Res,
  HttpStatus,
  ParseUUIDPipe,
  Session,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PartyProfileDocumentsService } from './party-profile-documents.service';
import { PartyProfileDocumentsResponseDto } from './dto/party-profile-documents-response.dto';
import type { PartyProfileDocumentUploadFile } from './party-profile-document-upload-file';

@ApiTags('party-profile-documents')
@UseGuards(PermissionsGuard)
@Controller('party-profiles/:partyProfileId/documents')
export class PartyProfileDocumentsController {
  constructor(
    private readonly partyProfileDocumentsService: PartyProfileDocumentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get document requirements and current uploads for a party profile' })
  @ApiResponse({ status: 200, type: PartyProfileDocumentsResponseDto })
  async getDocuments(
    @Param('partyProfileId', ParseUUIDPipe) partyProfileId: string,
  ): Promise<PartyProfileDocumentsResponseDto> {
    return this.partyProfileDocumentsService.getDocuments(partyProfileId);
  }

  @Post(':documentProfileRuleId')
  @ApiOperation({ summary: 'Upload or replace a document for a specific rule' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, type: PartyProfileDocumentsResponseDto })
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Param('partyProfileId', ParseUUIDPipe) partyProfileId: string,
    @Param('documentProfileRuleId', ParseUUIDPipe) documentProfileRuleId: string,
    @UploadedFile() file: PartyProfileDocumentUploadFile,
    @Session() session: any,
  ): Promise<PartyProfileDocumentsResponseDto> {
    return this.partyProfileDocumentsService.uploadDocument(
      partyProfileId,
      documentProfileRuleId,
      file,
      session.userId,
    );
  }

  @Get(':documentProfileRuleId/download')
  @ApiOperation({ summary: 'Download the stored file for a party profile rule' })
  async downloadDocument(
    @Param('partyProfileId', ParseUUIDPipe) partyProfileId: string,
    @Param('documentProfileRuleId', ParseUUIDPipe) documentProfileRuleId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const payload = await this.partyProfileDocumentsService.downloadDocument(
      partyProfileId,
      documentProfileRuleId,
    );

    res.status(HttpStatus.OK);
    res.setHeader('Content-Type', payload.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${payload.fileName}"`);
    return payload.file;
  }
}
