import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import { SelectOption } from "./category-option.entity";
import { CreateSelectOptionDto } from "./dto/create-category-option.dto";
import { UpdateSelectOptionDto } from "./dto/update-category-option.dto";
import { SelectOptionResponseDto } from "./dto/category-option-response.dto";
import { StaticSelectOptionResponseDto } from "./dto/static-select-option-response.dto";
import { CategoryOptionCodeEnum } from "./category-option-code.enum";
import {
  getStaticSelectOptions,
  type StaticSelectOption,
} from "./category-option-static-options";

type CacheEntry = {
  expiresAt: number;
  data: SelectOptionResponseDto[];
};

@Injectable()
export class SelectOptionService {
  private readonly systemUserId = '00000000-0000-0000-0000-000000000000';
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<SelectOptionResponseDto[]>>();
  private readonly cacheTtlMs = 5 * 60 * 1000;

  constructor(
    @InjectRepository(SelectOption)
    private readonly selectOptionRepository: Repository<SelectOption>,
  ) {}

  private getCacheKey(code: string): string {
    return code.trim().replace(/[_\s-]/g, '').toLowerCase();
  }

  private normalizeCode(code: string): string {
    return code.trim().replace(/[_\s-]/g, '').toUpperCase();
  }

  private resolveStaticOptions(code: string): StaticSelectOption[] | null {
    return getStaticSelectOptions(code);
  }

  private ensureStaticValueIsAllowed(code: string, value: string): void {
    const staticOptions = this.resolveStaticOptions(code);

    if (!staticOptions) {
      return;
    }

    const normalizedValue = this.normalizeComparableStaticValue(value);
    const allowedValues = new Set(
      staticOptions.map(option => this.normalizeComparableStaticValue(option.value)),
    );

    if (!allowedValues.has(normalizedValue)) {
      throw new BadRequestException(
        `Invalid value for static code ${this.normalizeCode(code)}. Allowed values: ${staticOptions
          .map(option => option.value)
          .join(', ')}`,
      );
    }
  }

  private normalizeStaticLabel(code: string, value: string): string {
    const staticOptions = this.resolveStaticOptions(code);

    if (!staticOptions) {
      return value.trim().toUpperCase();
    }

    const normalizedValue = this.normalizeComparableStaticValue(value);
    return (
      staticOptions.find(
        option =>
          this.normalizeComparableStaticValue(option.value) === normalizedValue ||
          this.normalizeComparableStaticValue(option.label) === normalizedValue,
      )?.label ??
      normalizedValue
    );
  }

  private normalizeComparableStaticValue(value: string): string {
    return value.trim().replace(/[_\s-]/g, '').toUpperCase();
  }

  private resolveStaticValue(code: string, value: string): string {
    const staticOptions = this.resolveStaticOptions(code);

    if (!staticOptions) {
      return value.trim().toUpperCase();
    }

    const normalizedValue = this.normalizeComparableStaticValue(value);
    const matchedOption = staticOptions.find(
      option =>
        this.normalizeComparableStaticValue(option.value) === normalizedValue ||
        this.normalizeComparableStaticValue(option.label) === normalizedValue,
    );

    return matchedOption?.value ?? value.trim().toUpperCase();
  }

  private invalidateCache(code?: string): void {
    if (!code) {
      this.cache.clear();
      this.inflight.clear();
      return;
    }

    const cacheKey = this.getCacheKey(code);
    this.cache.delete(cacheKey);
    this.inflight.delete(cacheKey);
  }

  private async loadOptionsByCode(code: string): Promise<SelectOptionResponseDto[]> {
    const normalizedCode = this.normalizeCode(code);
    const cacheKey = this.getCacheKey(normalizedCode);
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const inflight = this.inflight.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const loader = this.selectOptionRepository
      .createQueryBuilder("selectOption")
      .where("REPLACE(UPPER(selectOption.code), '_', '') = :code", {
        code: normalizedCode,
      })
      .andWhere("selectOption.isActive = true")
      .orderBy("selectOption.sortOrder", "ASC")
      .addOrderBy("selectOption.label", "ASC")
      .getMany()
      .then(options => {
        const data = options.map(SelectOptionResponseDto.fromEntity);
        this.cache.set(cacheKey, {
          expiresAt: Date.now() + this.cacheTtlMs,
          data,
        });
        this.inflight.delete(cacheKey);
        return data;
      })
      .catch(error => {
        this.inflight.delete(cacheKey);
        throw error;
      });

    this.inflight.set(cacheKey, loader);
    return loader;
  }

  async getOptionsByCode(code: string): Promise<SelectOptionResponseDto[]> {
    return this.loadOptionsByCode(code);
  }

  async getStaticOptionsByCode(
    code: string,
  ): Promise<StaticSelectOptionResponseDto[]> {
    const staticOptions = this.resolveStaticOptions(code);

    if (!staticOptions) {
      throw new BadRequestException(
        `Static select options are not defined for code ${this.normalizeCode(code)}`,
      );
    }

    return staticOptions.map(StaticSelectOptionResponseDto.fromValue);
  }

  async getAllOptions(search?: string): Promise<SelectOptionResponseDto[]> {
    const normalizedSearch = search?.trim();
    const options = await this.selectOptionRepository.find({
      where: normalizedSearch ? { code: ILike(`%${normalizedSearch}%`) } : undefined,
      order: {
        code: 'ASC',
        sortOrder: 'ASC',
        label: 'ASC',
      },
    });

    return options.map(SelectOptionResponseDto.fromEntity);
  }

  async getOptionById(id: string): Promise<SelectOptionResponseDto> {
    const option = await this.selectOptionRepository.findOne({ where: { id } });

    if (!option) {
      throw new NotFoundException(`Select option with id ${id} not found`);
    }

    return SelectOptionResponseDto.fromEntity(option);
  }

  async create(
    dto: CreateSelectOptionDto,
    userId?: string,
  ): Promise<SelectOptionResponseDto> {
    const normalizedCode = this.normalizeCode(dto.code);
    const normalizedValue = this.resolveStaticValue(normalizedCode, dto.value);
    const normalizedLabel = this.normalizeStaticLabel(normalizedCode, dto.label);

    this.ensureStaticValueIsAllowed(normalizedCode, normalizedValue);

    const existing = await this.selectOptionRepository
      .createQueryBuilder("selectOption")
      .where("REPLACE(UPPER(selectOption.code), '_', '') = :code", {
        code: normalizedCode,
      })
      .andWhere("selectOption.value = :value", {
        value: normalizedValue,
      })
      .getOne();

    if (existing) {
      throw new ConflictException("Select option already exists for this code and value");
    }

    const option = this.selectOptionRepository.create({
      code: normalizedCode,
      value: normalizedValue,
      label: normalizedLabel,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
      createdBy: userId || this.systemUserId,
      updatedBy: userId || this.systemUserId,
    });

    const saved = await this.selectOptionRepository.save(option);
    this.invalidateCache(saved.code);
    return SelectOptionResponseDto.fromEntity(saved);
  }

  async update(
    id: string,
    dto: UpdateSelectOptionDto,
    userId?: string,
  ): Promise<SelectOptionResponseDto> {
    const option = await this.selectOptionRepository.findOne({ where: { id } });

    if (!option) {
      throw new NotFoundException(`Select option with id ${id} not found`);
    }

    const nextCode = option.code;
    const nextValue = dto.value
      ? this.resolveStaticValue(nextCode, dto.value)
      : option.value;
    const nextLabel = dto.label
      ? this.normalizeStaticLabel(nextCode, dto.label)
      : this.normalizeStaticLabel(nextCode, nextValue);
    const nextSortOrder = dto.sortOrder ?? option.sortOrder;
    const nextIsActive = dto.isActive ?? option.isActive;

    this.ensureStaticValueIsAllowed(nextCode, nextValue);

    option.value = nextValue;
    option.label = nextLabel;
    option.sortOrder = nextSortOrder;
    option.isActive = nextIsActive;
    option.updatedBy = userId || this.systemUserId;

    const saved = await this.selectOptionRepository.save(option);
    this.invalidateCache(nextCode);
    return SelectOptionResponseDto.fromEntity(saved);
  }

  async bulkUpsert(
    options: CreateSelectOptionDto[],
    userId?: string,
  ): Promise<SelectOptionResponseDto[]> {
    const result: SelectOptionResponseDto[] = [];

    for (const item of options) {
      const normalizedCode = this.normalizeCode(item.code);
      const normalizedValue = this.resolveStaticValue(normalizedCode, item.value);
      const normalizedLabel = this.normalizeStaticLabel(normalizedCode, item.label);

      this.ensureStaticValueIsAllowed(normalizedCode, normalizedValue);
      const existing = await this.selectOptionRepository
        .createQueryBuilder("selectOption")
        .where("REPLACE(UPPER(selectOption.code), '_', '') = :code", {
          code: normalizedCode,
        })
        .andWhere("selectOption.value = :value", {
          value: normalizedValue,
        })
        .getOne();

      if (existing) {
        existing.label = normalizedLabel;
        existing.sortOrder = item.sortOrder ?? existing.sortOrder;
        existing.isActive = item.isActive ?? existing.isActive;
        existing.updatedBy = userId || this.systemUserId;
        const saved = await this.selectOptionRepository.save(existing);
        this.invalidateCache(saved.code);
        result.push(SelectOptionResponseDto.fromEntity(saved));
        continue;
      }

      const created = await this.selectOptionRepository.save(
        this.selectOptionRepository.create({
          code: normalizedCode,
          value: normalizedValue,
          label: normalizedLabel,
          sortOrder: item.sortOrder ?? 0,
          isActive: item.isActive ?? true,
          createdBy: userId || this.systemUserId,
          updatedBy: userId || this.systemUserId,
        }),
      );
      this.invalidateCache(created.code);
      result.push(SelectOptionResponseDto.fromEntity(created));
    }

    return result;
  }

  async getCodes(): Promise<CategoryOptionCodeEnum[]> {
    const rows = await this.selectOptionRepository
      .createQueryBuilder("selectOption")
      .select("DISTINCT selectOption.code", "code")
      .orderBy("selectOption.code", "ASC")
      .getRawMany<{ code: string }>();

    return [...new Set(rows.map(row => this.normalizeCode(row.code)))] as CategoryOptionCodeEnum[];
  }
}
