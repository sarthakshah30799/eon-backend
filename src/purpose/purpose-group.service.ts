import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Not, Repository } from 'typeorm';
import { Purpose } from './purpose.entity';
import { PurposeGroup } from './purpose-group.entity';
import { PurposeGroupPurpose } from './purpose-group-purpose.entity';
import { CreatePurposeGroupDto } from './dto/create-purpose-group.dto';
import { UpdatePurposeGroupDto } from './dto/update-purpose-group.dto';
import { PurposeGroupResponseDto } from './dto/purpose-group-response.dto';
import { PurposeGroupListQueryDto } from './dto/purpose-group-list-query.dto';
import { PurposeGroupProfileType } from './purpose.enums';

@Injectable()
export class PurposeGroupService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PurposeGroup)
    private readonly purposeGroupRepository: Repository<PurposeGroup>,
    @InjectRepository(PurposeGroupPurpose)
    private readonly purposeGroupPurposeRepository: Repository<PurposeGroupPurpose>,
    @InjectRepository(Purpose)
    private readonly purposeRepository: Repository<Purpose>,
  ) {}

  private normalizeText(value?: string | null): string {
    return String(value ?? '').trim();
  }

  private async loadGroupOrFail(id: string): Promise<PurposeGroup> {
    const purposeGroup = await this.purposeGroupRepository
      .createQueryBuilder('purposeGroup')
      .leftJoinAndSelect('purposeGroup.purposes', 'link')
      .leftJoinAndSelect('link.purpose', 'purpose')
      .leftJoinAndSelect('purpose.slabs', 'slab')
      .where('purposeGroup.id = :id', { id })
      .orderBy('purpose.code', 'ASC')
      .addOrderBy('slab.sortOrder', 'ASC')
      .getOne();

    if (!purposeGroup) {
      throw new NotFoundException(`Purpose group with id "${id}" not found`);
    }

    return purposeGroup;
  }

  private async ensureUniqueName(
    name: string,
    profileType: PurposeGroupProfileType,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.purposeGroupRepository.findOne({
      where: excludeId
        ? { name, profileType, id: Not(excludeId) }
        : { name, profileType },
    });
    if (existing) {
      throw new ConflictException(
        `Purpose group "${name}" already exists for ${profileType}`,
      );
    }
  }

  private async resolveSellPurposes(purposeIds: string[]): Promise<Purpose[]> {
    const uniqueIds = [...new Set(purposeIds)];
    if (uniqueIds.length === 0) {
      return [];
    }

    const purposes = await this.purposeRepository.find({
      where: { id: In(uniqueIds) },
    });
    if (purposes.length !== uniqueIds.length) {
      throw new BadRequestException('One or more selected purposes were not found');
    }

    const nonSell = purposes.filter(purpose => !purpose.sell);
    if (nonSell.length > 0) {
      throw new BadRequestException(
        `Purpose groups can only include sell purposes: ${nonSell
          .map(purpose => purpose.code)
          .join(', ')}`,
      );
    }

    return purposes;
  }

  private async ensurePurposesAreUniquePerProfile(
    purposeIds: string[],
    profileType: PurposeGroupProfileType,
    excludeGroupId?: string,
  ): Promise<void> {
    if (purposeIds.length === 0) {
      return;
    }

    const qb = this.purposeGroupPurposeRepository
      .createQueryBuilder('link')
      .innerJoin('link.purposeGroup', 'purposeGroup')
      .innerJoin('link.purpose', 'purpose')
      .where('link.purposeId IN (:...purposeIds)', { purposeIds })
      .andWhere('purposeGroup.profileType = :profileType', { profileType });

    if (excludeGroupId) {
      qb.andWhere('purposeGroup.id != :excludeGroupId', { excludeGroupId });
    }

    const conflict = await qb
      .select(['purpose.code AS code', 'purposeGroup.name AS name'])
      .getRawOne<{ code: string; name: string }>();

    if (conflict) {
      throw new ConflictException(
        `Purpose ${conflict.code} is already assigned to ${profileType} group "${conflict.name}"`,
      );
    }
  }

  async findAll(query?: PurposeGroupListQueryDto): Promise<PurposeGroupResponseDto[]> {
    const qb = this.purposeGroupRepository
      .createQueryBuilder('purposeGroup')
      .leftJoinAndSelect('purposeGroup.purposes', 'link')
      .leftJoinAndSelect('link.purpose', 'purpose')
      .leftJoinAndSelect('purpose.slabs', 'slab');

    const search = this.normalizeText(query?.search);
    if (search) {
      const like = `%${search}%`;
      qb.andWhere(
        new Brackets(searchQb => {
          searchQb
            .where('purposeGroup.name ILIKE :like', { like })
            .orWhere('purposeGroup.title ILIKE :like', { like });
        }),
      );
    }

    if (query?.profileType) {
      qb.andWhere('purposeGroup.profileType = :profileType', {
        profileType: query.profileType,
      });
    }

    const purposeGroups = await qb
      .orderBy('purposeGroup.profileType', 'ASC')
      .addOrderBy('purposeGroup.sortOrder', 'ASC')
      .addOrderBy('purposeGroup.name', 'ASC')
      .addOrderBy('purpose.code', 'ASC')
      .getMany();

    purposeGroups.sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.profileType.localeCompare(right.profileType) ||
        left.name.localeCompare(right.name),
    );

    return purposeGroups.map(PurposeGroupResponseDto.fromEntity);
  }

  async findById(id: string): Promise<PurposeGroupResponseDto> {
    const purposeGroup = await this.loadGroupOrFail(id);
    return PurposeGroupResponseDto.fromEntity(purposeGroup);
  }

  async create(
    dto: CreatePurposeGroupDto,
    userId: string,
  ): Promise<PurposeGroupResponseDto> {
    const name = this.normalizeText(dto.name);
    const title = this.normalizeText(dto.title);
    if (!name || !title) {
      throw new BadRequestException('Group name and report title are required');
    }

    await this.ensureUniqueName(name, dto.profileType);
    const purposes = await this.resolveSellPurposes(dto.purposeIds ?? []);
    await this.ensurePurposesAreUniquePerProfile(
      purposes.map(purpose => purpose.id),
      dto.profileType,
    );

    const saved = await this.dataSource.transaction(async manager => {
      const purposeGroupRepository = manager.getRepository(PurposeGroup);
      const purposeGroupPurposeRepository = manager.getRepository(PurposeGroupPurpose);

      const purposeGroup = await purposeGroupRepository.save(
        purposeGroupRepository.create({
          name,
          title,
          profileType: dto.profileType,
          sortOrder: dto.sortOrder ?? 0,
          createdBy: userId,
          updatedBy: userId,
        }),
      );

      if (purposes.length > 0) {
        await purposeGroupPurposeRepository.save(
          purposes.map(purpose =>
            purposeGroupPurposeRepository.create({
              purposeGroupId: purposeGroup.id,
              purposeId: purpose.id,
              createdBy: userId,
              updatedBy: userId,
            }),
          ),
        );
      }

      return purposeGroup.id;
    });

    return this.findById(saved);
  }

  async update(
    id: string,
    dto: UpdatePurposeGroupDto,
    userId: string,
  ): Promise<PurposeGroupResponseDto> {
    const existing = await this.loadGroupOrFail(id);
    const name =
      dto.name !== undefined ? this.normalizeText(dto.name) : existing.name;
    const title =
      dto.title !== undefined ? this.normalizeText(dto.title) : existing.title;
    const profileType = dto.profileType ?? existing.profileType;

    if (!name || !title) {
      throw new BadRequestException('Group name and report title are required');
    }

    if (name !== existing.name || profileType !== existing.profileType) {
      await this.ensureUniqueName(name, profileType, existing.id);
    }

    const nextPurposeIds =
      dto.purposeIds !== undefined
        ? (await this.resolveSellPurposes(dto.purposeIds)).map(purpose => purpose.id)
        : (existing.purposes ?? []).map(link => link.purposeId);

    await this.ensurePurposesAreUniquePerProfile(nextPurposeIds, profileType, existing.id);

    await this.dataSource.transaction(async manager => {
      const purposeGroupRepository = manager.getRepository(PurposeGroup);
      const purposeGroupPurposeRepository = manager.getRepository(PurposeGroupPurpose);

      existing.name = name;
      existing.title = title;
      existing.profileType = profileType;
      if (dto.sortOrder !== undefined) {
        existing.sortOrder = dto.sortOrder;
      }
      existing.updatedBy = userId;
      await purposeGroupRepository.save(existing);

      if (dto.purposeIds !== undefined) {
        const previousLinks = await purposeGroupPurposeRepository.find({
          where: { purposeGroupId: existing.id },
        });
        if (previousLinks.length > 0) {
          for (const link of previousLinks) {
            link.deletedBy = userId;
          }
          await purposeGroupPurposeRepository.softRemove(previousLinks);
        }

        if (nextPurposeIds.length > 0) {
          await purposeGroupPurposeRepository.save(
            nextPurposeIds.map(purposeId =>
              purposeGroupPurposeRepository.create({
                purposeGroupId: existing.id,
                purposeId,
                createdBy: userId,
                updatedBy: userId,
              }),
            ),
          );
        }
      }
    });

    return this.findById(id);
  }

  async delete(id: string, userId: string): Promise<{ message: string }> {
    const purposeGroup = await this.purposeGroupRepository.findOne({
      where: { id },
      relations: { purposes: true },
    });

    if (!purposeGroup) {
      throw new NotFoundException(`Purpose group with id ${id} not found`);
    }

    await this.dataSource.transaction(async manager => {
      const purposeGroupRepository = manager.getRepository(PurposeGroup);
      const purposeGroupPurposeRepository = manager.getRepository(PurposeGroupPurpose);

      const links = await purposeGroupPurposeRepository.find({
        where: { purposeGroupId: id },
      });
      if (links.length > 0) {
        for (const link of links) {
          link.deletedBy = userId;
        }
        await purposeGroupPurposeRepository.softRemove(links);
      }

      purposeGroup.deletedBy = userId;
      await purposeGroupRepository.softRemove(purposeGroup);
    });

    return { message: `Purpose group with id ${id} deleted successfully` };
  }
}
