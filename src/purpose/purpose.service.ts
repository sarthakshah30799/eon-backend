import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { Purpose } from './purpose.entity';
import { PurposeSlab } from './purpose-slab.entity';
import { CreatePurposeDto } from './dto/create-purpose.dto';
import { UpdatePurposeDto } from './dto/update-purpose.dto';
import { PurposeResponseDto } from './dto/purpose-response.dto';
import { PurposeListQueryDto } from './dto/purpose-list-query.dto';
import { TransactionType } from '../transactions/transactions.enums';

@Injectable()
export class PurposeService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Purpose)
    private readonly purposeRepository: Repository<Purpose>,
    @InjectRepository(PurposeSlab)
    private readonly purposeSlabRepository: Repository<PurposeSlab>,
  ) {}

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  private normalizeText(value?: string | null): string {
    return String(value ?? '').trim();
  }

  private ensureCodeLength(code: string): void {
    if (code.length !== 2) {
      throw new BadRequestException('Purpose code must be exactly 2 characters');
    }
  }

  private ensureSlabRules(slabs?: CreatePurposeDto['slabs']): void {
    if (!slabs || slabs.length === 0) {
      return;
    }

    const seenSortOrders = new Set<number>();
    for (const slab of slabs) {
      if (seenSortOrders.has(slab.sortOrder)) {
        throw new BadRequestException(`Duplicate slab sort order ${slab.sortOrder}`);
      }
      seenSortOrders.add(slab.sortOrder);

      if (slab.toAmount !== undefined && slab.toAmount !== null && slab.toAmount < slab.fromAmount) {
        throw new BadRequestException(`Slab sort order ${slab.sortOrder}: toAmount cannot be less than fromAmount`);
      }
    }
  }

  private ensureScopeRules(scope: Pick<Purpose, 'corporate' | 'individual' | 'sell' | 'purchase'>): void {
    if (!scope.corporate && !scope.individual) {
      throw new BadRequestException('Purpose must apply to at least one party profile type');
    }

    if (!scope.sell && !scope.purchase) {
      throw new BadRequestException('Purpose must apply to at least one transaction type');
    }
  }

  private async ensureUniqueCode(code: string, excludeId?: string): Promise<void> {
    const existing = await this.purposeRepository.findOne({ where: { code } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Purpose with code "${code}" already exists`);
    }
  }

  private async loadPurposeOrFail(
    field: 'id' | 'code',
    value: string,
  ): Promise<Purpose> {
    const qb = this.purposeRepository
      .createQueryBuilder('purpose')
      .leftJoinAndSelect('purpose.slabs', 'slab')
      .where(`purpose.${field} = :value`, { value });

    const purpose = await qb
      .orderBy('slab.sortOrder', 'ASC')
      .getOne();

    if (!purpose) {
      throw new NotFoundException(`Purpose with ${field} "${value}" not found`);
    }

    return purpose;
  }

  async findAll(query?: PurposeListQueryDto): Promise<PurposeResponseDto[]> {
    const qb = this.purposeRepository
      .createQueryBuilder('purpose')
      .leftJoinAndSelect('purpose.slabs', 'slab');

    const search = this.normalizeText(query?.search);
    if (search) {
      const like = `%${search}%`;
      qb.andWhere(
        new Brackets(searchQb => {
          searchQb
            .where('purpose.code ILIKE :like', { like })
            .orWhere('purpose.description ILIKE :like', { like })
            .orWhere('purpose.threshold::text ILIKE :like', { like })
            .orWhere('purpose.rate::text ILIKE :like', { like });
        }),
      );
    }

    if (query?.transactionType === TransactionType.SALE) {
      qb.andWhere('purpose.sell = true');
    }

    if (query?.transactionType === TransactionType.PURCHASE) {
      qb.andWhere('purpose.purchase = true');
    }

    if (query?.partyProfileType === 'CORPORATE') {
      qb.andWhere('purpose.corporate = true');
    }

    if (query?.partyProfileType === 'INDIVIDUAL') {
      qb.andWhere('purpose.individual = true');
    }

    const purposes = await qb
      .orderBy('purpose.code', 'ASC')
      .addOrderBy('slab.sortOrder', 'ASC')
      .getMany();

    return purposes.map(PurposeResponseDto.fromEntity);
  }

  async findById(id: string): Promise<PurposeResponseDto> {
    const purpose = await this.loadPurposeOrFail('id', id);
    return PurposeResponseDto.fromEntity(purpose);
  }

  async findByCode(code: string): Promise<PurposeResponseDto> {
    const purpose = await this.loadPurposeOrFail('code', this.normalizeCode(code));
    return PurposeResponseDto.fromEntity(purpose);
  }

  async create(dto: CreatePurposeDto, userId: string): Promise<PurposeResponseDto> {
    const code = this.normalizeCode(dto.code);
    this.ensureCodeLength(code);
    this.ensureSlabRules(dto.slabs);
    const scope = {
      corporate: dto.corporate ?? false,
      individual: dto.individual ?? false,
      sell: dto.sell ?? false,
      purchase: dto.purchase ?? false,
    };
    this.ensureScopeRules(scope);
    await this.ensureUniqueCode(code);

    const result = await this.dataSource.transaction(async manager => {
      const purposeRepository = manager.getRepository(Purpose);
      const purposeSlabRepository = manager.getRepository(PurposeSlab);

      const purpose = purposeRepository.create({
        code,
        description: this.normalizeText(dto.description),
        threshold: String(dto.threshold ?? 0),
        rate: String(dto.rate ?? 0),
        rateType: dto.rateType ?? undefined,
        ...scope,
        createdBy: userId,
        updatedBy: userId,
      });

      const savedPurpose = await purposeRepository.save(purpose);

      const slabs = (dto.slabs ?? [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(slab =>
          purposeSlabRepository.create({
            purposeId: savedPurpose.id,
            sortOrder: slab.sortOrder,
            fromAmount: String(slab.fromAmount),
            toAmount: slab.toAmount === undefined || slab.toAmount === null ? null : String(slab.toAmount),
            rate: String(slab.rate),
            rateType: slab.rateType,
            createdBy: userId,
            updatedBy: userId,
          }),
        );

      if (slabs.length > 0) {
        await purposeSlabRepository.save(slabs);
      }

      return purposeRepository
        .createQueryBuilder('purpose')
        .leftJoinAndSelect('purpose.slabs', 'slab')
        .where('purpose.id = :id', { id: savedPurpose.id })
        .orderBy('slab.sortOrder', 'ASC')
        .getOneOrFail();
    });

    return PurposeResponseDto.fromEntity(result);
  }

  async update(id: string, dto: UpdatePurposeDto, userId: string): Promise<PurposeResponseDto> {
    const existing = await this.purposeRepository.findOne({
      where: { id },
      relations: { slabs: true },
    });

    if (!existing) {
      throw new NotFoundException(`Purpose with id ${id} not found`);
    }

    const code = dto.code !== undefined ? this.normalizeCode(dto.code) : existing.code;
    this.ensureCodeLength(code);
    this.ensureSlabRules(dto.slabs);
    if (code !== existing.code) {
      await this.ensureUniqueCode(code, existing.id);
    }

    const result = await this.dataSource.transaction(async manager => {
      const purposeRepository = manager.getRepository(Purpose);
      const purposeSlabRepository = manager.getRepository(PurposeSlab);

      existing.code = code;
      if (dto.description !== undefined) {
        existing.description = this.normalizeText(dto.description);
      }
      if (dto.threshold !== undefined) {
        existing.threshold = String(dto.threshold);
      }
      if (dto.rate !== undefined) {
        existing.rate = String(dto.rate);
      }
      if (dto.rateType !== undefined) {
        existing.rateType = dto.rateType;
      }
      if (dto.corporate !== undefined) {
        existing.corporate = dto.corporate;
      }
      if (dto.individual !== undefined) {
        existing.individual = dto.individual;
      }
      if (dto.sell !== undefined) {
        existing.sell = dto.sell;
      }
      if (dto.purchase !== undefined) {
        existing.purchase = dto.purchase;
      }
      this.ensureScopeRules(existing);
      existing.updatedBy = userId;

      await purposeRepository.save(existing);

      if (dto.slabs !== undefined) {
        const previousSlabs = await purposeSlabRepository.find({
          where: { purposeId: existing.id },
        });
        if (previousSlabs.length > 0) {
          for (const slab of previousSlabs) {
            slab.deletedBy = userId;
          }
          await purposeSlabRepository.softRemove(previousSlabs);
        }

        const nextSlabs = dto.slabs
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(slab =>
            purposeSlabRepository.create({
              purposeId: existing.id,
              sortOrder: slab.sortOrder,
              fromAmount: String(slab.fromAmount),
              toAmount: slab.toAmount === undefined || slab.toAmount === null ? null : String(slab.toAmount),
              rate: String(slab.rate),
              rateType: slab.rateType,
              createdBy: userId,
              updatedBy: userId,
            }),
          );

        if (nextSlabs.length > 0) {
          await purposeSlabRepository.save(nextSlabs);
        }
      }

      const updated = await purposeRepository
        .createQueryBuilder('purpose')
        .leftJoinAndSelect('purpose.slabs', 'slab')
        .where('purpose.id = :id', { id: existing.id })
        .orderBy('slab.sortOrder', 'ASC')
        .getOneOrFail();

      return updated;
    });

    return PurposeResponseDto.fromEntity(result);
  }

  async delete(id: string, userId: string): Promise<{ message: string }> {
    const purpose = await this.purposeRepository.findOne({
      where: { id },
      relations: { slabs: true },
    });

    if (!purpose) {
      throw new NotFoundException(`Purpose with id ${id} not found`);
    }

    await this.dataSource.transaction(async manager => {
      const purposeRepository = manager.getRepository(Purpose);
      const purposeSlabRepository = manager.getRepository(PurposeSlab);

      const loaded = await purposeRepository.findOne({
        where: { id },
        relations: { slabs: true },
      });
      if (!loaded) {
        return;
      }

      loaded.deletedBy = userId;
      await purposeRepository.softRemove(loaded);

      const slabs = await purposeSlabRepository.find({ where: { purposeId: id } });
      if (slabs.length > 0) {
        for (const slab of slabs) {
          slab.deletedBy = userId;
        }
        await purposeSlabRepository.softRemove(slabs);
      }
    });

    return { message: `Purpose with id ${id} deleted successfully` };
  }
}
