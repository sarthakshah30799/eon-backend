import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SelectOption } from '../category-options/category-option.entity';
import { DocumentProfile } from './document-profile.entity';
import { CreateDocumentProfileDto } from './dto/create-document-profile.dto';
import { UpdateDocumentProfileDto } from './dto/update-document-profile.dto';
import { DocumentProfileResponseDto } from './dto/document-profile-response.dto';
import { ResolveDocumentProfilesDto } from './dto/resolve-document-profile-rules.dto';
import {
  applyDocumentProfileFilters,
  normalizeDocumentProfilePayload,
} from './document-profile.utils';
import { DOCUMENT_TYPE_OPTIONS } from './document-profile.constants';
import { DocumentSpecificationType } from './document-profile.entity';

@Injectable()
export class DocumentProfileService {
  constructor(
    @InjectRepository(DocumentProfile)
    private readonly documentProfileRepository: Repository<DocumentProfile>,
  ) {}

  async findAll(): Promise<DocumentProfileResponseDto[]> {
    const profiles = await this.documentProfileRepository
      .createQueryBuilder('documentProfile')
      .leftJoinAndSelect('documentProfile.type', 'type')
      .leftJoinAndSelect('documentProfile.groupSelection', 'groupSelection')
      .leftJoinAndSelect('documentProfile.entitySelection', 'entitySelection')
      .leftJoinAndSelect('documentProfile.financialYearSelection', 'financialYearSelection')
      .orderBy('documentProfile.sortOrder', 'ASC')
      .addOrderBy('documentProfile.documentCode', 'ASC')
      .getMany();

    return profiles.map(profile =>
      DocumentProfileResponseDto.fromEntity(profile),
    );
  }

  async findById(id: string): Promise<DocumentProfileResponseDto> {
    const profile = await this.documentProfileRepository
      .createQueryBuilder('documentProfile')
      .leftJoinAndSelect('documentProfile.type', 'type')
      .leftJoinAndSelect('documentProfile.groupSelection', 'groupSelection')
      .leftJoinAndSelect('documentProfile.entitySelection', 'entitySelection')
      .leftJoinAndSelect('documentProfile.financialYearSelection', 'financialYearSelection')
      .where('documentProfile.id = :id', { id })
      .getOne();

    if (!profile) {
      throw new NotFoundException(`Document profile with id ${id} not found`);
    }

    return DocumentProfileResponseDto.fromEntity(profile);
  }

  async create(
    dto: CreateDocumentProfileDto,
    userId: string,
  ): Promise<DocumentProfileResponseDto> {
    const normalizedCode = dto.documentCode.trim().toUpperCase();
    await this.ensureDocumentCodeIsUnique(normalizedCode);
    this.ensureValidDocumentTypes(dto.documentType);

    const profile = this.documentProfileRepository.create(
      normalizeDocumentProfilePayload({
        documentCode: normalizedCode,
        documentDescription: dto.documentDescription,
        documentType: dto.documentType,
        isRequired: dto.isRequired ?? false,
        maxSizeMb: dto.maxSizeMb,
        specificationType: dto.specificationType,
        type: { id: dto.type } as SelectOption,
        groupSelection: { id: dto.groupSelection } as SelectOption,
        entitySelection: { id: dto.entitySelection } as SelectOption,
        financialYearSelection: dto.financialYearSelection
          ? ({ id: dto.financialYearSelection } as SelectOption)
          : null,
        active: dto.active ?? true,
        sortOrder: dto.sortOrder ?? 0,
      }) as DocumentProfile,
    );
    profile.createdBy = userId;
    profile.updatedBy = userId;

    const saved = await this.documentProfileRepository.save(profile);
    return this.findById(saved.id);
  }

  async update(
    id: string,
    dto: UpdateDocumentProfileDto,
    userId: string,
  ): Promise<DocumentProfileResponseDto> {
    const profile = await this.documentProfileRepository.findOne({
      where: { id },
    });

    if (!profile) {
      throw new NotFoundException(`Document profile with id ${id} not found`);
    }

    const nextCode = (dto.documentCode ?? profile.documentCode).trim().toUpperCase();
    if (nextCode !== profile.documentCode) {
      await this.ensureDocumentCodeIsUnique(nextCode, id);
    }

    const nextDocumentType = dto.documentType ?? profile.documentType;
    if (dto.documentType) {
      this.ensureValidDocumentTypes(dto.documentType);
    }

    Object.assign(
      profile,
      normalizeDocumentProfilePayload({
        documentCode: nextCode,
        documentDescription: dto.documentDescription ?? profile.documentDescription,
        documentType: nextDocumentType,
        isRequired: dto.isRequired ?? profile.isRequired,
        maxSizeMb: dto.maxSizeMb ?? profile.maxSizeMb,
        specificationType: dto.specificationType ?? profile.specificationType,
        type: dto.type ? ({ id: dto.type } as SelectOption) : profile.type,
        groupSelection: dto.groupSelection
          ? ({ id: dto.groupSelection } as SelectOption)
          : profile.groupSelection,
        entitySelection: dto.entitySelection
          ? ({ id: dto.entitySelection } as SelectOption)
          : profile.entitySelection,
        financialYearSelection: dto.financialYearSelection
          ? ({ id: dto.financialYearSelection } as SelectOption)
          : dto.financialYearSelection === null
            ? null
            : profile.financialYearSelection,
        active: dto.active ?? profile.active,
        sortOrder: dto.sortOrder ?? profile.sortOrder,
      }) as DocumentProfile,
    );
    profile.updatedBy = userId;

    await this.documentProfileRepository.save(profile);
    return this.findById(id);
  }

  async delete(id: string): Promise<{ message: string }> {
    const profile = await this.documentProfileRepository.findOne({
      where: { id },
    });

    if (!profile) {
      throw new NotFoundException(`Document profile with id ${id} not found`);
    }

    await this.documentProfileRepository.remove(profile);
    return { message: `Document profile with id ${id} deleted successfully` };
  }

  async resolveRules(
    query: ResolveDocumentProfilesDto,
  ): Promise<DocumentProfileResponseDto[]> {
    const queryBuilder = this.documentProfileRepository
      .createQueryBuilder('documentProfile')
      .leftJoinAndSelect('documentProfile.type', 'type')
      .leftJoinAndSelect('documentProfile.groupSelection', 'groupSelection')
      .leftJoinAndSelect('documentProfile.entitySelection', 'entitySelection')
      .leftJoinAndSelect('documentProfile.financialYearSelection', 'financialYearSelection')
      .where('1 = 1');

    applyDocumentProfileFilters(queryBuilder, 'documentProfile', {
      groupSelection: query.groupSelection,
      entitySelection: query.entitySelection,
      activeOnly: true,
    });

    const profiles = await queryBuilder
      .orderBy('documentProfile.sortOrder', 'ASC')
      .addOrderBy('documentProfile.documentCode', 'ASC')
      .getMany();

    return profiles.map(profile =>
      DocumentProfileResponseDto.fromEntity(profile),
    );
  }

  private async ensureDocumentCodeIsUnique(
    documentCode: string,
    excludeProfileId?: string,
  ) {
    const existingProfile = await this.documentProfileRepository.findOne({
      where: { documentCode },
    });

    if (existingProfile && existingProfile.id !== excludeProfileId) {
      throw new ConflictException(
        `Document profile with code "${documentCode}" already exists`,
      );
    }
  }

  private ensureValidDocumentTypes(documentTypes: string[]) {
    const invalidType = documentTypes.find(
      type => !DOCUMENT_TYPE_OPTIONS.includes(type.trim().toUpperCase() as never),
    );

    if (invalidType) {
      throw new BadRequestException(`Unsupported document type "${invalidType}"`);
    }
  }
}
