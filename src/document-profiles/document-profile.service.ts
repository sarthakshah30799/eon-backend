import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentProfile } from './document-profile.entity';
import { DocumentProfileRule } from './document-profile-rule.entity';
import { CreateDocumentProfileDto } from './dto/create-document-profile.dto';
import { UpdateDocumentProfileDto } from './dto/update-document-profile.dto';
import { DocumentProfileResponseDto } from './dto/document-profile-response.dto';
import { ResolveDocumentProfileRulesDto } from './dto/resolve-document-profile-rules.dto';
import {
  normalizeDocumentProfilePayload,
  normalizeDocumentProfileRulePayload,
  resolveDocumentProfileRules,
} from './document-profile.utils';
import { DOCUMENT_TYPE_OPTIONS } from './document-profile.constants';

@Injectable()
export class DocumentProfileService {
  constructor(
    @InjectRepository(DocumentProfile)
    private readonly documentProfileRepository: Repository<DocumentProfile>,
    @InjectRepository(DocumentProfileRule)
    private readonly documentProfileRuleRepository: Repository<DocumentProfileRule>,
  ) {}

  async findAll(): Promise<DocumentProfileResponseDto[]> {
    const profiles = await this.documentProfileRepository
      .createQueryBuilder('documentProfile')
      .leftJoinAndSelect('documentProfile.rules', 'rule')
      .orderBy('documentProfile.sortOrder', 'ASC')
      .addOrderBy('rule.sortOrder', 'ASC')
      .addOrderBy('rule.documentCode', 'ASC')
      .getMany();

    return profiles.map(DocumentProfileResponseDto.fromEntity);
  }

  async findById(id: string): Promise<DocumentProfileResponseDto> {
    const profile = await this.documentProfileRepository
      .createQueryBuilder('documentProfile')
      .leftJoinAndSelect('documentProfile.rules', 'rule')
      .where('documentProfile.id = :id', { id })
      .orderBy('rule.sortOrder', 'ASC')
      .addOrderBy('rule.documentCode', 'ASC')
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
    const normalizedSpecificationType = dto.specificationType.trim();
    const normalizedTransactionType = dto.transactionType.trim();
    await this.ensureProfileCodeIsUnique(normalizedSpecificationType);
    await this.ensureRuleCodesAreUnique(dto.rules);
    this.ensureValidDocumentTypes(dto.rules.flatMap(rule => rule.documentType));

    const profile = this.documentProfileRepository.create({
      ...normalizeDocumentProfilePayload({
        profileCode: normalizedSpecificationType,
        profileName: normalizedTransactionType,
        profileDescription: null,
        active: dto.active ?? true,
        sortOrder: dto.sortOrder ?? 0,
      }),
      createdBy: userId,
      updatedBy: userId,
      rules: dto.rules.map(rule =>
        this.documentProfileRuleRepository.create({
          ...normalizeDocumentProfileRulePayload(rule),
          createdBy: userId,
          updatedBy: userId,
        }),
      ),
    });

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
      relations: { rules: true },
    });

    if (!profile) {
      throw new NotFoundException(`Document profile with id ${id} not found`);
    }

    if (dto.specificationType) {
      const normalizedSpecificationType = dto.specificationType.trim();
      await this.ensureProfileCodeIsUnique(normalizedSpecificationType, id);
      profile.profileCode = normalizedSpecificationType;
    }

    if (dto.transactionType !== undefined) {
      profile.profileName = dto.transactionType.trim();
    }

    if (dto.active !== undefined) {
      profile.active = dto.active;
    }

    if (dto.sortOrder !== undefined) {
      profile.sortOrder = dto.sortOrder;
    }

    profile.updatedBy = userId;

    if (dto.rules) {
      this.ensureValidDocumentTypes(dto.rules.flatMap(rule => rule.documentType));
      await this.ensureRuleCodesAreUnique(dto.rules, id);
      await this.documentProfileRuleRepository.delete({
        documentProfileId: id,
      });
      profile.rules = dto.rules.map(rule =>
        this.documentProfileRuleRepository.create({
          ...normalizeDocumentProfileRulePayload(rule),
          documentProfileId: id,
          createdBy: userId,
          updatedBy: userId,
        }),
      );
    }

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
    query: ResolveDocumentProfileRulesDto,
  ): Promise<DocumentProfileResponseDto[]> {
    const profiles = await this.documentProfileRepository
      .createQueryBuilder('documentProfile')
      .leftJoinAndSelect('documentProfile.rules', 'rule')
      .where('documentProfile.active = true')
      .andWhere('rule.active = true')
      .orderBy('documentProfile.sortOrder', 'ASC')
      .addOrderBy('rule.sortOrder', 'ASC')
      .getMany();

    return profiles
      .map(profile => ({
        ...profile,
        rules: resolveDocumentProfileRules(profile.rules ?? [], query),
      }))
      .filter(profile => profile.rules.length > 0)
      .map(DocumentProfileResponseDto.fromEntity);
  }

  private async ensureProfileCodeIsUnique(code: string, excludeId?: string) {
    const existing = await this.documentProfileRepository.findOne({
      where: { profileCode: code },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `Document profile with code "${code}" already exists`,
      );
    }
  }

  private async ensureRuleCodesAreUnique(
    rules: Array<Pick<CreateDocumentProfileDto['rules'][number], 'documentCode'>>,
    excludeProfileId?: string,
  ) {
    const normalizedCodes = rules.map(rule => rule.documentCode.trim().toUpperCase());
    const duplicateInPayload = normalizedCodes.find(
      (code, index) => normalizedCodes.indexOf(code) !== index,
    );

    if (duplicateInPayload) {
      throw new BadRequestException(
        `Duplicate document code "${duplicateInPayload}" found in payload`,
      );
    }

    const existingRule = await this.documentProfileRuleRepository
      .createQueryBuilder('rule')
      .where('UPPER(rule.documentCode) IN (:...codes)', {
        codes: normalizedCodes,
      })
      .getOne();

    if (existingRule) {
      if (!excludeProfileId || existingRule.documentProfileId !== excludeProfileId) {
        throw new ConflictException(
          `Document rule with code "${existingRule.documentCode}" already exists`,
        );
      }
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

