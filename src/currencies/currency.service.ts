import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Currency, CurrencyProductAllowed } from './currency.entity';
import { Country } from '../country/country.entity';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { CurrencyResponseDto } from './dto/currency-response.dto';
import { CurrencyRateGroup } from '../currency-rates/currency-rate-group.entity';
import { CurrencyListQueryDto } from './dto/currency-list-query.dto';

@Injectable()
export class CurrencyService {
  constructor(
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
    @InjectRepository(CurrencyRateGroup)
    private readonly pricingGroupRepository: Repository<CurrencyRateGroup>,
  ) {}

  private applyBusinessRules(currency: Currency): void {
    if (!currency.onlyStocking) {
      currency.productAllowed = '';
      return;
    }

    currency.productAllowed =
      currency.productAllowed || CurrencyProductAllowed.CN;
  }

  async findAll(query?: CurrencyListQueryDto): Promise<CurrencyResponseDto[]> {
    const qb = this.currencyRepository
      .createQueryBuilder('currency')
      .leftJoinAndSelect('currency.country', 'country')
      .leftJoinAndSelect('currency.pricingGroup', 'pricingGroup')
      .orderBy('currency.createdAt', 'DESC');

    const trimmedSearch = query?.search?.trim();
    if (trimmedSearch) {
      qb.andWhere(
        new Brackets(searchQb => {
          searchQb
            .where('currency.currencyCode ILIKE :search', { search: `%${trimmedSearch}%` })
            .orWhere('currency.currencyName ILIKE :search', { search: `%${trimmedSearch}%` })
            .orWhere('country.name ILIKE :search', { search: `%${trimmedSearch}%` });
        }),
      );
    }

    const currencies = await qb.getMany();
    return currencies.map(CurrencyResponseDto.fromEntity);
  }

  async findById(id: string): Promise<CurrencyResponseDto> {
    const currency = await this.currencyRepository.findOne({
      where: { id },
      relations: ['country', 'pricingGroup'],
    });

    if (!currency) {
      throw new NotFoundException(`Currency with id ${id} not found`);
    }

    return CurrencyResponseDto.fromEntity(currency);
  }

  async create(
    dto: CreateCurrencyDto,
    userId: string,
  ): Promise<CurrencyResponseDto> {
    const currencyCode = dto.currencyCode.toUpperCase();
    const existing = await this.currencyRepository.findOne({
      where: { currencyCode },
    });

    if (existing) {
      throw new ConflictException(
        `Currency with code "${currencyCode}" already exists`,
      );
    }

    const country = await this.countryRepository.findOne({
      where: { id: dto.countryId },
    });

    if (!country) {
      throw new NotFoundException(`Country with id ${dto.countryId} not found`);
    }

    let pricingGroup = null;
    if (dto.pricingGroupId) {
      pricingGroup = await this.pricingGroupRepository.findOne({
        where: { id: dto.pricingGroupId },
      });
      if (!pricingGroup) {
        throw new NotFoundException(`Currency pricing group with id ${dto.pricingGroupId} not found`);
      }
    }

    const { countryId: _countryId, pricingGroupId: _pricingGroupId, ...otherFields } = dto;
    void _countryId;
    void _pricingGroupId;
    const currency = this.currencyRepository.create({
      ...otherFields,
      currencyCode,
      country,
      pricingGroup,
      active: dto.active ?? false,
      onlyStocking: dto.onlyStocking ?? false,
      productAllowed: dto.productAllowed ?? '',
      createdBy: userId,
      updatedBy: userId,
    });

    this.applyBusinessRules(currency);

    const saved = await this.currencyRepository.save(currency);
    return this.findById(saved.id);
  }

  async update(
    id: string,
    dto: UpdateCurrencyDto,
    userId: string,
  ): Promise<CurrencyResponseDto> {
    const currency = await this.currencyRepository.findOne({
      where: { id },
      relations: ['country'],
    });

    if (!currency) {
      throw new NotFoundException(`Currency with id ${id} not found`);
    }

    if (dto.currencyCode) {
      const currencyCode = dto.currencyCode.toUpperCase();
      if (currencyCode !== currency.currencyCode) {
        const existing = await this.currencyRepository.findOne({
          where: { currencyCode },
        });

        if (existing) {
          throw new ConflictException(
            `Currency with code "${currencyCode}" already exists`,
          );
        }

        currency.currencyCode = currencyCode;
      }
    }

    if (dto.countryId) {
      const country = await this.countryRepository.findOne({
        where: { id: dto.countryId },
      });

      if (!country) {
        throw new NotFoundException(
          `Country with id ${dto.countryId} not found`,
        );
      }

      currency.country = country;
    }

    if (dto.pricingGroupId !== undefined) {
      if (dto.pricingGroupId === null || dto.pricingGroupId === '') {
        currency.pricingGroup = null;
      } else {
        const pricingGroup = await this.pricingGroupRepository.findOne({
          where: { id: dto.pricingGroupId },
        });

        if (!pricingGroup) {
          throw new NotFoundException(
            `Currency pricing group with id ${dto.pricingGroupId} not found`,
          );
        }

        currency.pricingGroup = pricingGroup;
      }
    }

    const { currencyCode, countryId, pricingGroupId, ...otherFields } = dto;
    Object.assign(currency, otherFields);
    currency.updatedBy = userId;
    this.applyBusinessRules(currency);

    await this.currencyRepository.save(currency);
    return this.findById(id);
  }

  async delete(id: string): Promise<{ message: string }> {
    const currency = await this.currencyRepository.findOne({ where: { id } });

    if (!currency) {
      throw new NotFoundException(`Currency with id ${id} not found`);
    }

    await this.currencyRepository.remove(currency);
    return { message: `Currency with id ${id} deleted successfully` };
  }
}
