import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Currency, CurrencyProductAllowed } from './currency.entity';
import { Country } from '../country/country.entity';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { CurrencyResponseDto } from './dto/currency-response.dto';

@Injectable()
export class CurrencyService {
  constructor(
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
  ) {}

  private applyBusinessRules(currency: Currency): void {
    if (!currency.onlyStocking) {
      currency.productAllowed = '';
      return;
    }

    currency.productAllowed =
      currency.productAllowed || CurrencyProductAllowed.CN;
  }

  async findAll(): Promise<CurrencyResponseDto[]> {
    const currencies = await this.currencyRepository.find({
      relations: ['country'],
      order: { createdAt: 'DESC' },
    });

    return currencies.map(CurrencyResponseDto.fromEntity);
  }

  async findById(id: string): Promise<CurrencyResponseDto> {
    const currency = await this.currencyRepository.findOne({
      where: { id },
      relations: ['country'],
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

    const { countryId: _countryId, ...otherFields } = dto;
    void _countryId;
    const currency = this.currencyRepository.create({
      ...otherFields,
      currencyCode,
      country,
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

    const { currencyCode, countryId, ...otherFields } = dto;
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
