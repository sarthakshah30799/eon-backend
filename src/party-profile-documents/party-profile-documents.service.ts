import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { StreamableFile } from '@nestjs/common';
import type { PartyProfileDocumentUploadFile } from './party-profile-document-upload-file';
import { PartyProfile } from '../party-profiles/party-profile.entity';
import { DocumentProfile } from '../document-profiles/document-profile.entity';
import { DocumentProfileRule } from '../document-profiles/document-profile-rule.entity';
import {
  applyDocumentProfileFilters,
  resolveDocumentProfileRules,
} from '../document-profiles/document-profile.utils';
import { PartyProfileDocument } from './party-profile-document.entity';
import { PartyProfileDocumentFile } from './party-profile-document-file.entity';
import { PartyProfileDocumentsResponseDto } from './dto/party-profile-documents-response.dto';
import { PartyProfileDocumentProfileResponseDto } from './dto/party-profile-document-profile-response.dto';

const MASTER_SPECIFICATION_TYPE = 'MASTER';

const isAllowedDocumentMimeType = (
  mimeType: string,
  documentTypes: string[],
) => {
  const normalizedTypes = documentTypes.map(type => type.trim().toUpperCase());

  if (normalizedTypes.includes('ANY')) {
    return true;
  }

  return normalizedTypes.some(type => {
    if (type === 'PDF') {
      return mimeType === 'application/pdf';
    }

    if (type === 'IMAGE') {
      return mimeType.startsWith('image/');
    }

    if (type === 'JPEG') {
      return mimeType === 'image/jpeg';
    }

    if (type === 'PNG') {
      return mimeType === 'image/png';
    }

    if (type === 'DOC') {
      return [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ].includes(mimeType);
    }

    if (type === 'XLS') {
      return [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ].includes(mimeType);
    }

    return false;
  });
};

@Injectable()
export class PartyProfileDocumentsService {
  constructor(
    @InjectRepository(PartyProfile)
    private readonly partyProfileRepository: Repository<PartyProfile>,
    @InjectRepository(DocumentProfile)
    private readonly documentProfileRepository: Repository<DocumentProfile>,
    @InjectRepository(DocumentProfileRule)
    private readonly documentProfileRuleRepository: Repository<DocumentProfileRule>,
    @InjectRepository(PartyProfileDocument)
    private readonly partyProfileDocumentRepository: Repository<PartyProfileDocument>,
    @InjectRepository(PartyProfileDocumentFile)
    private readonly partyProfileDocumentFileRepository: Repository<PartyProfileDocumentFile>,
  ) {}

  async getDocuments(partyProfileId: string): Promise<PartyProfileDocumentsResponseDto> {
    const partyProfile = await this.partyProfileRepository.findOne({
      where: { id: partyProfileId },
    });

    if (!partyProfile) {
      throw new NotFoundException(`Party profile with id ${partyProfileId} not found`);
    }

    const profiles = await this.loadMatchingDocumentProfiles(
      partyProfile.type,
      partyProfile.group,
      partyProfile.entityType,
    );
    const ruleIds = profiles.flatMap(profile => profile.rules.map(rule => rule.id));
    const existingDocuments = ruleIds.length
      ? await this.partyProfileDocumentRepository.find({
          where: {
            partyProfileId,
            documentProfileRuleId: In(ruleIds),
          },
          relations: {
            documentFile: true,
          },
        })
      : [];

    const documentsByRuleId = new Map(
      existingDocuments.map(document => [document.documentProfileRuleId, document]),
    );

    return {
      partyProfileId,
      documentProfiles: profiles.map(profile =>
        PartyProfileDocumentProfileResponseDto.fromEntity(profile, documentsByRuleId),
      ),
    };
  }

  async uploadDocument(
    partyProfileId: string,
    documentProfileRuleId: string,
    file: PartyProfileDocumentUploadFile,
    userId: string,
  ): Promise<PartyProfileDocumentsResponseDto> {
    if (!file) {
      throw new BadRequestException('Document file is required');
    }

    const partyProfile = await this.partyProfileRepository.findOne({
      where: { id: partyProfileId },
    });

    if (!partyProfile) {
      throw new NotFoundException(`Party profile with id ${partyProfileId} not found`);
    }

    const documentProfileRule = await this.documentProfileRuleRepository.findOne({
      where: { id: documentProfileRuleId },
      relations: {
        documentProfile: true,
      },
    });

    if (!documentProfileRule || !documentProfileRule.documentProfile) {
      throw new NotFoundException(
        `Document profile rule with id ${documentProfileRuleId} not found`,
      );
    }

    const allowedProfiles = await this.loadMatchingDocumentProfiles(
      partyProfile.type,
      partyProfile.group,
      partyProfile.entityType,
    );
    const allowedRule = allowedProfiles
      .flatMap(profile => profile.rules)
      .find(rule => rule.id === documentProfileRuleId);

    if (!allowedRule) {
      throw new BadRequestException(
        'Document rule does not match the selected party profile',
      );
    }

    if (file.size > Number(allowedRule.maxSizeMb) * 1024 * 1024) {
      throw new BadRequestException(
        `File exceeds max size of ${allowedRule.maxSizeMb} MB`,
      );
    }

    if (!isAllowedDocumentMimeType(file.mimetype, allowedRule.documentType)) {
      throw new BadRequestException(
        `Unsupported file type for ${allowedRule.documentType.join(', ')}`,
      );
    }

    const existingDocument = await this.partyProfileDocumentRepository.findOne({
      where: {
        partyProfileId,
        documentProfileRuleId,
      },
      relations: {
        documentFile: true,
      },
    });

    const document = this.partyProfileDocumentRepository.create({
      ...(existingDocument ?? {}),
      partyProfileId,
      documentProfileId: allowedRule.documentProfileId,
      documentProfileRuleId,
      createdBy: existingDocument?.createdBy ?? userId,
      updatedBy: userId,
    });

    const savedDocument = await this.partyProfileDocumentRepository.save(document);
    const savedFile = await this.partyProfileDocumentFileRepository.save({
      ...(existingDocument?.documentFile ?? {}),
      partyProfileDocumentId: savedDocument.id,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      content: file.buffer,
      createdBy: existingDocument?.documentFile?.createdBy ?? userId,
      updatedBy: userId,
    });

    savedDocument.documentFile = savedFile;

    return this.getDocuments(partyProfileId);
  }

  async downloadDocument(
    partyProfileId: string,
    documentProfileRuleId: string,
  ): Promise<{ file: StreamableFile; fileName: string; mimeType: string }> {
    const document = await this.partyProfileDocumentRepository.findOne({
      where: {
        partyProfileId,
        documentProfileRuleId,
      },
      relations: {
        documentFile: true,
      },
    });

    if (!document?.documentFile) {
      throw new NotFoundException('Document file not found');
    }

    const file = document.documentFile;

    return {
      file: new StreamableFile(file.content),
      fileName: file.fileName,
      mimeType: file.mimeType,
    };
  }

  private async loadMatchingDocumentProfiles(
    type?: string | null,
    groupSelection?: string | null,
    entitySelection?: string | null,
  ) {
    if (!type || !groupSelection || !entitySelection) {
      return [];
    }

    const queryBuilder = this.documentProfileRepository
      .createQueryBuilder('documentProfile')
      .leftJoinAndSelect('documentProfile.rules', 'rule')
      .where('1 = 1');

    applyDocumentProfileFilters(queryBuilder, 'documentProfile', 'rule', {
      specificationType: MASTER_SPECIFICATION_TYPE,
      type,
      groupSelection,
      entitySelection,
      activeOnly: true,
      activeRulesOnly: true,
    });

    const profiles = await queryBuilder
      .orderBy('documentProfile.sortOrder', 'ASC')
      .addOrderBy('rule.sortOrder', 'ASC')
      .getMany();

    return profiles
      .map(profile => ({
        ...profile,
        rules: resolveDocumentProfileRules(profile.rules ?? []),
      }))
      .filter(profile => profile.rules.length > 0);
  }
}
