import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { StreamableFile } from '@nestjs/common';
import type { PartyProfileDocumentUploadFile } from './party-profile-document-upload-file';
import { SelectOption } from '../category-options/category-option.entity';
import { CategoryOptionCodeEnum } from '../category-options/category-option-code.enum';
import { PartyProfile } from '../party-profiles/party-profile.entity';
import { DocumentProfile, DocumentSpecificationType } from '../document-profiles/document-profile.entity';
import { PartyProfileDocument } from './party-profile-document.entity';
import { PartyProfileDocumentFile } from './party-profile-document-file.entity';
import { PartyProfileDocumentsResponseDto } from './dto/party-profile-documents-response.dto';
import { PartyProfileDocumentProfileResponseDto } from './dto/party-profile-document-profile-response.dto';

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
    @InjectRepository(SelectOption)
    private readonly selectOptionRepository: Repository<SelectOption>,
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
      await this.resolveDocumentGroupSelection(partyProfile.group),
      partyProfile.entityType,
    );
    const profileIds = profiles.map(profile => profile.id);
    const existingDocuments = profileIds.length
      ? await this.partyProfileDocumentRepository.find({
          where: {
            partyProfileId,
            documentProfileId: In(profileIds),
          },
          relations: {
            documentFile: true,
          },
        })
      : [];

    const documentsByProfileId = new Map(
      existingDocuments.map(document => [document.documentProfileId, document]),
    );

    return {
      partyProfileId,
      documentProfiles: profiles.map(profile =>
        PartyProfileDocumentProfileResponseDto.fromEntity(profile, documentsByProfileId),
      ),
    };
  }

  async uploadDocument(
    partyProfileId: string,
    documentProfileId: string,
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

    const documentProfile = await this.documentProfileRepository.findOne({
      where: { id: documentProfileId },
    });

    if (!documentProfile) {
      throw new NotFoundException(
        `Document profile with id ${documentProfileId} not found`,
      );
    }

    const allowedProfiles = await this.loadMatchingDocumentProfiles(
      partyProfile.type,
      await this.resolveDocumentGroupSelection(partyProfile.group),
      partyProfile.entityType,
    );
    const allowedProfile = allowedProfiles.find(profile => profile.id === documentProfileId);

    if (!allowedProfile) {
      throw new BadRequestException(
        'Document profile does not match the selected party profile',
      );
    }

    if (file.size > Number(allowedProfile.maxSizeMb) * 1024 * 1024) {
      throw new BadRequestException(
        `File exceeds max size of ${allowedProfile.maxSizeMb} MB`,
      );
    }

    if (!isAllowedDocumentMimeType(file.mimetype, allowedProfile.documentType)) {
      throw new BadRequestException(
        `Unsupported file type for ${allowedProfile.documentType.join(', ')}`,
      );
    }

    const existingDocument = await this.partyProfileDocumentRepository.findOne({
      where: {
        partyProfileId,
        documentProfileId,
      },
      relations: {
        documentFile: true,
      },
    });

    const document = this.partyProfileDocumentRepository.create({
      ...(existingDocument ?? {}),
      partyProfileId,
      documentProfileId,
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
    documentProfileId: string,
  ): Promise<{ file: StreamableFile; fileName: string; mimeType: string }> {
    const document = await this.partyProfileDocumentRepository.findOne({
      where: {
        partyProfileId,
        documentProfileId,
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
    documentGroupSelection?: string | null,
    entitySelection?: string | null,
  ) {
    if (!type || !documentGroupSelection || !entitySelection) {
      return [];
    }

    const queryBuilder = this.documentProfileRepository
      .createQueryBuilder('documentProfile')
      .leftJoin('category_options', 'typeOption', 'typeOption.id = documentProfile.type')
      .where('1 = 1')
      .andWhere('documentProfile.active = true')
      .andWhere('documentProfile.specificationType = :specificationType', {
        specificationType: DocumentSpecificationType.MASTER,
      });

    queryBuilder.andWhere(
      '(LOWER(typeOption.value) = LOWER(:partyProfileType) OR LOWER(typeOption.label) = LOWER(:partyProfileType))',
      { partyProfileType: type },
    );

    queryBuilder.andWhere('documentProfile.groupSelection = :groupSelection', {
      groupSelection: documentGroupSelection,
    });

    queryBuilder.andWhere('documentProfile.entitySelection = :entitySelection', {
      entitySelection,
    });

    return queryBuilder
      .orderBy('documentProfile.sortOrder', 'ASC')
      .addOrderBy('documentProfile.documentCode', 'ASC')
      .getMany();
  }

  private async resolveDocumentGroupSelection(partyGroupId?: string | null) {
    if (!partyGroupId) {
      return null;
    }

    const partyGroup = await this.selectOptionRepository.findOne({
      where: { id: partyGroupId },
    });

    if (!partyGroup) {
      return null;
    }

    const documentGroup = await this.selectOptionRepository.findOne({
      where: {
        code: CategoryOptionCodeEnum.DocumentGroup,
        value: partyGroup.value,
      },
    });

    return documentGroup?.id ?? null;
  }
}
