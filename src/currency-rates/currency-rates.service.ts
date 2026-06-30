import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Currency } from '../currencies/currency.entity';
import { Product } from '../products/product.entity';
import { CurrencyRateGroup } from './currency-rate-group.entity';
import { CurrencyRate } from './currency-rate.entity';
import { ProductCurrencyRate } from './product-currency-rate.entity';
import {
  CurrencyRateMarginType,
  CurrencyRateProvider,
} from './currency-rates.enums';
import {
  CurrencyRateMarginConfig,
  CurrencyRateQuote,
  CurrencyRateRuleConfig,
  ProductCurrencyPricingRule,
} from './currency-rates.types';
import { CreateCurrencyRateGroupDto } from './dto/create-currency-rate-group.dto';
import { UpdateCurrencyRateGroupDto } from './dto/update-currency-rate-group.dto';
import { CreateCurrencyRateDto } from './dto/create-currency-rate.dto';
import { PreviewCurrencyRateDto } from './dto/preview-currency-rate.dto';
import { CreateProductCurrencyRateDto } from './dto/create-product-currency-rate.dto';
import { UpdateProductCurrencyRateDto } from './dto/update-product-currency-rate.dto';

type CurrencyRateSideConfig = CurrencyRateMarginConfig;

const normalizeGroupCode = (code?: string | null) => String(code ?? '').trim().toUpperCase();
const normalizeOptionalText = (value?: string | null) => {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : null;
};

@Injectable()
export class CurrencyRatesService {
  constructor(
    @InjectRepository(CurrencyRateGroup)
    private readonly groupRepository: Repository<CurrencyRateGroup>,
    @InjectRepository(CurrencyRate)
    private readonly rateRepository: Repository<CurrencyRate>,
    @InjectRepository(ProductCurrencyRate)
    private readonly productCurrencyRateRepository: Repository<ProductCurrencyRate>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
  ) {}

  private ruleFromProductCurrencyRate(rule: ProductCurrencyRate): CurrencyRateRuleConfig {
    return {
      buy: {
        marginType: rule.buyMarginType,
        marginValue: rule.buyMarginValue,
        minRate: rule.buyMinRate,
        maxRate: rule.buyMaxRate,
      },
      sale: {
        marginType: rule.saleMarginType,
        marginValue: rule.saleMarginValue,
        minRate: rule.saleMinRate,
        maxRate: rule.saleMaxRate,
      },
    };
  }

  private ruleFromGroup(group: CurrencyRateGroup): CurrencyRateRuleConfig {
    return {
      buy: {
        marginType: group.buyMarginType ?? '',
        marginValue: group.buyMarginValue ?? '',
        minRate: '',
        maxRate: '',
      },
      sale: {
        marginType: group.saleMarginType ?? '',
        marginValue: group.saleMarginValue ?? '',
        minRate: '',
        maxRate: '',
      },
    };
  }

  async createGroup(dto: CreateCurrencyRateGroupDto, userId: string): Promise<CurrencyRateGroup> {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.groupRepository.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException(`Currency rate group with code "${code}" already exists`);
    }

    const group = this.groupRepository.create({
      code,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      buyMarginType: dto.buyMarginType ?? null,
      buyMarginValue: dto.buyMarginValue ?? null,
      saleMarginType: dto.saleMarginType ?? null,
      saleMarginValue: dto.saleMarginValue ?? null,
      isActive: dto.isActive ?? true,
      createdBy: userId,
      updatedBy: userId,
    });

    return this.groupRepository.save(group);
  }

  async updateGroup(id: string, dto: UpdateCurrencyRateGroupDto, userId: string): Promise<CurrencyRateGroup> {
    const group = await this.groupRepository.findOne({ where: { id } });
    if (!group) {
      throw new NotFoundException(`Currency rate group with id ${id} not found`);
    }

    if (dto.code !== undefined) {
      const code = dto.code.trim().toUpperCase();
      if (code !== group.code) {
        const existing = await this.groupRepository.findOne({ where: { code } });
        if (existing) {
          throw new ConflictException(`Currency rate group with code "${code}" already exists`);
        }
        group.code = code;
      }
    }

    if (dto.name !== undefined) {
      group.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      group.description = dto.description?.trim() || null;
    }
    if (dto.buyMarginType !== undefined) {
      group.buyMarginType = dto.buyMarginType;
    }
    if (dto.buyMarginValue !== undefined) {
      group.buyMarginValue = dto.buyMarginValue;
    }
    if (dto.saleMarginType !== undefined) {
      group.saleMarginType = dto.saleMarginType;
    }
    if (dto.saleMarginValue !== undefined) {
      group.saleMarginValue = dto.saleMarginValue;
    }
    if (dto.isActive !== undefined) {
      group.isActive = dto.isActive;
    }
    group.updatedBy = userId;
    return this.groupRepository.save(group);
  }

  async findGroups(): Promise<CurrencyRateGroup[]> {
    return this.groupRepository.find({ order: { createdAt: 'DESC' } });
  }

  async createRateEntry(dto: CreateCurrencyRateDto, userId: string): Promise<CurrencyRate> {
    const currency = await this.currencyRepository.findOne({
      where: { id: dto.currencyId },
      relations: ['pricingGroup'],
    });
    if (!currency) {
      throw new NotFoundException(`Currency with id ${dto.currencyId} not found`);
    }

    let baseBuyRate = dto.baseBuyRate ?? null;
    let baseSaleRate = dto.baseSaleRate ?? null;
    let baseRate = dto.baseRate ?? null;

    if (dto.provider === CurrencyRateProvider.FOREX || dto.provider === CurrencyRateProvider.MANUAL) {
      if (baseRate) {
        baseBuyRate = baseRate;
        baseSaleRate = baseRate;
      } else if (!baseBuyRate || !baseSaleRate) {
        throw new BadRequestException('baseRate or baseBuyRate/baseSaleRate is required for FOREX and MANUAL providers');
      } else if (dto.provider === CurrencyRateProvider.MANUAL) {
        baseRate = baseBuyRate;
      }
    } else {
      if (!baseBuyRate || !baseSaleRate) {
        throw new BadRequestException('baseBuyRate and baseSaleRate are required for TICKER provider');
      }
      baseRate = null;
    }

    const entry = this.rateRepository.create({
      currency,
      currencyId: currency.id,
      provider: dto.provider,
      baseBuyRate,
      baseSaleRate,
      baseRate,
      isActive: dto.isActive ?? true,
      notes: dto.notes?.trim() || null,
      enteredBy: userId,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.rateRepository.save(entry);
    const savedWithRelations = await this.rateRepository.findOne({
      where: { id: saved.id },
      relations: ['currency', 'currency.country', 'currency.pricingGroup', 'enteredByUser'],
    });

    return savedWithRelations ?? saved;
  }

  async findLatestRates(currencyId?: string): Promise<CurrencyRate[]> {
    const qb = this.rateRepository.createQueryBuilder('rate')
      .leftJoinAndSelect('rate.currency', 'currency')
      .leftJoinAndSelect('rate.enteredByUser', 'enteredByUser')
      .orderBy('rate.createdAt', 'DESC');

    if (currencyId) {
      qb.andWhere('rate.currencyId = :currencyId', { currencyId });
    }

    return qb.getMany();
  }

  async createProductCurrencyRate(
    dto: CreateProductCurrencyRateDto,
    userId: string,
  ): Promise<ProductCurrencyPricingRule> {
    const product = await this.productRepository.findOne({ where: { id: dto.productId } });
    if (!product) {
      throw new NotFoundException(`Product with id ${dto.productId} not found`);
    }

    const currency = await this.currencyRepository.findOne({
      where: { id: dto.currencyId },
      relations: ['pricingGroup'],
    });
    if (!currency) {
      throw new NotFoundException(`Currency with id ${dto.currencyId} not found`);
    }

    const existing = await this.productCurrencyRateRepository.findOne({
      where: { productId: dto.productId, currencyId: dto.currencyId },
    });
    if (existing) {
      throw new ConflictException('Product currency pricing already exists for this product and currency');
    }

    const rule = this.productCurrencyRateRepository.create({
      product,
      productId: product.id,
      currency,
      currencyId: currency.id,
      buyMarginType: normalizeOptionalText(dto.buyMarginType) as CurrencyRateMarginType | null,
      buyMarginValue: normalizeOptionalText(dto.buyMarginValue),
      buyMinRate: normalizeOptionalText(dto.buyMinRate),
      buyMaxRate: normalizeOptionalText(dto.buyMaxRate),
      saleMarginType: normalizeOptionalText(dto.saleMarginType) as CurrencyRateMarginType | null,
      saleMarginValue: normalizeOptionalText(dto.saleMarginValue),
      saleMinRate: normalizeOptionalText(dto.saleMinRate),
      saleMaxRate: normalizeOptionalText(dto.saleMaxRate),
      isActive: dto.isActive ?? true,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.productCurrencyRateRepository.save(rule);
    const savedWithRelations = await this.productCurrencyRateRepository.findOne({
      where: { id: saved.id },
      relations: ['product', 'currency'],
    });

    return this.toProductCurrencyPricingRule(savedWithRelations ?? saved);
  }

  async updateProductCurrencyRate(
    id: string,
    dto: UpdateProductCurrencyRateDto,
    userId: string,
  ): Promise<ProductCurrencyPricingRule> {
    const rule = await this.productCurrencyRateRepository.findOne({
      where: { id },
      relations: ['product', 'currency'],
    });
    if (!rule) {
      throw new NotFoundException(`Product currency pricing with id ${id} not found`);
    }

    if (dto.productId !== undefined && dto.productId !== rule.productId) {
      const product = await this.productRepository.findOne({ where: { id: dto.productId } });
      if (!product) {
        throw new NotFoundException(`Product with id ${dto.productId} not found`);
      }
      const duplicate = await this.productCurrencyRateRepository.findOne({
        where: {
          productId: dto.productId,
          currencyId: dto.currencyId ?? rule.currencyId,
        },
      });
      if (duplicate && duplicate.id !== rule.id) {
        throw new ConflictException('Product currency pricing already exists for this product and currency');
      }
      rule.product = product;
      rule.productId = product.id;
    }

    if (dto.currencyId !== undefined && dto.currencyId !== rule.currencyId) {
      const currency = await this.currencyRepository.findOne({ where: { id: dto.currencyId } });
      if (!currency) {
        throw new NotFoundException(`Currency with id ${dto.currencyId} not found`);
      }
      const duplicate = await this.productCurrencyRateRepository.findOne({
        where: { productId: dto.productId ?? rule.productId, currencyId: dto.currencyId },
      });
      if (duplicate && duplicate.id !== rule.id) {
        throw new ConflictException('Product currency pricing already exists for this product and currency');
      }
      rule.currency = currency;
      rule.currencyId = currency.id;
    }

    if (dto.buyMarginType !== undefined) rule.buyMarginType = normalizeOptionalText(dto.buyMarginType) as CurrencyRateMarginType | null;
    if (dto.buyMarginValue !== undefined) rule.buyMarginValue = normalizeOptionalText(dto.buyMarginValue);
    if (dto.buyMinRate !== undefined) rule.buyMinRate = normalizeOptionalText(dto.buyMinRate);
    if (dto.buyMaxRate !== undefined) rule.buyMaxRate = normalizeOptionalText(dto.buyMaxRate);
    if (dto.saleMarginType !== undefined) rule.saleMarginType = normalizeOptionalText(dto.saleMarginType) as CurrencyRateMarginType | null;
    if (dto.saleMarginValue !== undefined) rule.saleMarginValue = normalizeOptionalText(dto.saleMarginValue);
    if (dto.saleMinRate !== undefined) rule.saleMinRate = normalizeOptionalText(dto.saleMinRate);
    if (dto.saleMaxRate !== undefined) rule.saleMaxRate = normalizeOptionalText(dto.saleMaxRate);
    if (dto.isActive !== undefined) rule.isActive = dto.isActive;

    rule.updatedBy = userId;
    const saved = await this.productCurrencyRateRepository.save(rule);
    const savedWithRelations = await this.productCurrencyRateRepository.findOne({
      where: { id: saved.id },
      relations: ['product', 'currency'],
    });
    return this.toProductCurrencyPricingRule(savedWithRelations ?? saved);
  }

  async findProductCurrencyRates(productId?: string, currencyId?: string): Promise<ProductCurrencyPricingRule[]> {
    const qb = this.productCurrencyRateRepository.createQueryBuilder('rule')
      .leftJoinAndSelect('rule.product', 'product')
      .leftJoinAndSelect('rule.currency', 'currency')
      .orderBy('rule.createdAt', 'DESC');

    if (productId) {
      qb.andWhere('rule.productId = :productId', { productId });
    }
    if (currencyId) {
      qb.andWhere('rule.currencyId = :currencyId', { currencyId });
    }

    const rows = await qb.getMany();
    return rows.map(row => this.toProductCurrencyPricingRule(row));
  }

  private toProductCurrencyPricingRule(entity: ProductCurrencyRate): ProductCurrencyPricingRule {
    return {
      id: entity.id,
      productId: entity.productId,
      currencyId: entity.currencyId,
      buy: {
        marginType: entity.buyMarginType,
        marginValue: entity.buyMarginValue,
        minRate: entity.buyMinRate,
        maxRate: entity.buyMaxRate,
      },
      sale: {
        marginType: entity.saleMarginType,
        marginValue: entity.saleMarginValue,
        minRate: entity.saleMinRate,
        maxRate: entity.saleMaxRate,
      },
      isActive: entity.isActive,
      product: entity.product
        ? {
            id: entity.product.id,
            productCode: entity.product.productCode,
            productDescription: entity.product.productDescription,
          }
        : null,
      currency: entity.currency
        ? {
            id: entity.currency.id,
            currencyCode: entity.currency.currencyCode,
            currencyName: entity.currency.currencyName,
          }
        : null,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private round(value: number, scale = 4): string {
    return value.toFixed(Math.max(scale, 0));
  }

  private parseDecimal(value: string): number {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(`Invalid decimal value "${value}"`);
    }
    return parsed;
  }

  private applyMargin(
    baseRate: string,
    margin: CurrencyRateSideConfig,
    direction: 'add' | 'subtract',
    scale = 4,
  ): { marginAmount: string; finalRate: string } {
    const base = this.parseDecimal(baseRate);
    const marginValue = this.parseDecimal(margin.marginValue);
    const amount = margin.marginType === CurrencyRateMarginType.PERCENT
      ? base * (marginValue / 100)
      : marginValue;
    const final = direction === 'subtract' ? base - amount : base + amount;

    return {
      marginAmount: this.round(amount, scale),
      finalRate: this.round(final, scale),
    };
  }

  private validateBand(finalRate: string, margin: CurrencyRateSideConfig): { isValid: boolean; reason?: string } {
    if (!margin.minRate || !margin.maxRate) {
      return { isValid: true };
    }

    const value = this.parseDecimal(finalRate);
    const min = this.parseDecimal(margin.minRate);
    const max = this.parseDecimal(margin.maxRate);

    if (value < min) {
      return { isValid: false, reason: `Final rate ${finalRate} is below minimum ${margin.minRate}` };
    }
    if (value > max) {
      return { isValid: false, reason: `Final rate ${finalRate} is above maximum ${margin.maxRate}` };
    }
    return { isValid: true };
  }

  private async resolvePricingRule(productId: string, currencyId: string): Promise<{
    product: Product;
    currency: Currency;
    rule: CurrencyRateRuleConfig;
    source: CurrencyRateQuote['effectiveSource'];
    groupCode: string | null;
    override: ProductCurrencyRate | null;
  }> {
    const product = await this.productRepository.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }

    const currency = await this.currencyRepository.findOne({
      where: { id: currencyId },
      relations: ['pricingGroup'],
    });
    if (!currency) {
      throw new NotFoundException(`Currency with id ${currencyId} not found`);
    }

    const override = await this.productCurrencyRateRepository.findOne({
      where: { productId, currencyId, isActive: true },
      relations: ['product', 'currency'],
    });
    if (override) {
      return {
        product,
        currency,
        rule: this.ruleFromProductCurrencyRate(override),
        source: 'product-override',
        groupCode: normalizeGroupCode(currency.pricingGroup?.code),
        override,
      };
    }

    const groupCode = normalizeGroupCode(currency.pricingGroup?.code);
    const group = currency.pricingGroup;
    if (!group) {
      throw new NotFoundException(`Currency with id ${currencyId} is not assigned to a pricing group`);
    }

    const groupRule = this.ruleFromGroup(group);

    if (!groupRule.buy || !groupRule.sale) {
      throw new NotFoundException(`No pricing rule found for currency group "${groupCode || 'N/A'}"`);
    }

    return {
      product,
      currency,
      rule: groupRule,
      source: 'group-default',
      groupCode,
      override: null,
    };
  }

  async previewQuote(dto: PreviewCurrencyRateDto): Promise<CurrencyRateQuote> {
    const { product, currency, rule, source, groupCode } = await this.resolvePricingRule(dto.productId, dto.currencyId);

    const baseBuyRate = dto.provider === CurrencyRateProvider.MANUAL
      ? (dto.baseRate ?? dto.baseBuyRate ?? dto.baseSaleRate)
      : (dto.baseBuyRate ?? dto.baseRate ?? '');
    const baseSaleRate = dto.provider === CurrencyRateProvider.MANUAL
      ? (dto.baseRate ?? dto.baseSaleRate ?? dto.baseBuyRate)
      : (dto.baseSaleRate ?? dto.baseRate ?? '');

    if (!baseBuyRate || !baseSaleRate) {
      throw new BadRequestException('Base buy and sale rates are required for preview');
    }

    const buy = this.applyMargin(baseBuyRate, rule.buy, 'subtract');
    const sale = this.applyMargin(baseSaleRate, rule.sale, 'add');
    const buyValidation = this.validateBand(buy.finalRate, rule.buy);
    const saleValidation = this.validateBand(sale.finalRate, rule.sale);

    return {
      productId: product.id,
      productCode: product.productCode,
      currencyId: currency.id,
      currencyCode: currency.currencyCode,
      provider: dto.provider,
      baseBuyRate,
      baseSaleRate,
      buy: {
        baseRate: baseBuyRate,
        ...buy,
        minRate: rule.buy.minRate,
        maxRate: rule.buy.maxRate,
        isValid: buyValidation.isValid,
        reason: buyValidation.reason,
      },
      sale: {
        baseRate: baseSaleRate,
        ...sale,
        minRate: rule.sale.minRate,
        maxRate: rule.sale.maxRate,
        isValid: saleValidation.isValid,
        reason: saleValidation.reason,
      },
      effectiveSource: source,
      effectiveGroupCode: groupCode,
    };
  }

  async getCurrencyRateContext(productId: string, currencyId: string): Promise<{
    product: Product;
    currency: Currency;
    effectiveSource: CurrencyRateQuote['effectiveSource'];
    effectiveGroupCode: string | null;
    hasOverride: boolean;
  }> {
    const resolved = await this.resolvePricingRule(productId, currencyId);
    return {
      product: resolved.product,
      currency: resolved.currency,
      effectiveSource: resolved.source,
      effectiveGroupCode: resolved.groupCode,
      hasOverride: resolved.source === 'product-override',
    };
  }
}
