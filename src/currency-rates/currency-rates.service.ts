import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdvancedSetting, NodeType, ValueType } from '../additional-settings/advanced-setting.entity';
import { Company } from '../company/company.entity';
import { Currency } from '../currencies/currency.entity';
import { CurrencyRateGroup } from './currency-rate-group.entity';
import { CurrencyRate } from './currency-rate.entity';
import {
  CurrencyRateMarginDirection,
  CurrencyRateMarginType,
  CurrencyRateProvider,
} from './currency-rates.enums';
import {
  CurrencyRateMarginConfig,
  CurrencyRateQuote,
  CurrencyRateRuleConfig,
  CurrencyRateSettings,
} from './currency-rates.types';
import { CreateCurrencyRateGroupDto } from './dto/create-currency-rate-group.dto';
import { UpdateCurrencyRateGroupDto } from './dto/update-currency-rate-group.dto';
import { CreateCurrencyRateDto } from './dto/create-currency-rate.dto';
import { SaveCurrencyRateSettingsDto } from './dto/save-currency-rate-settings.dto';
import { PreviewCurrencyRateDto } from './dto/preview-currency-rate.dto';

const SETTINGS_CATEGORY_CODE = 'CURRENCY_RATES';
const SETTINGS_CONFIG_CODE = 'CURRENCY_RATES_CONFIG';

const createDefaultMargin = (): CurrencyRateMarginConfig => ({
  marginType: CurrencyRateMarginType.PERCENT,
  marginValue: '0',
  marginDirection: CurrencyRateMarginDirection.ADD,
  minRate: '0',
  maxRate: '999999999',
});

const createDefaultRule = (): CurrencyRateRuleConfig => ({
  buy: createDefaultMargin(),
  sale: createDefaultMargin(),
});

const createDefaultSettings = (): CurrencyRateSettings => ({
  defaultProvider: CurrencyRateProvider.TICKER,
  roundingScale: 4,
  global: createDefaultRule(),
  groups: {},
  currencyOverrides: {},
});

@Injectable()
export class CurrencyRatesService {
  constructor(
    @InjectRepository(CurrencyRateGroup)
    private readonly groupRepository: Repository<CurrencyRateGroup>,
    @InjectRepository(CurrencyRate)
    private readonly rateRepository: Repository<CurrencyRate>,
    @InjectRepository(Currency)
    private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(AdvancedSetting)
    private readonly settingRepository: Repository<AdvancedSetting>,
  ) {}

  async getCompany(): Promise<Company | null> {
    return this.companyRepository.findOne({
      where: {},
      order: { createdAt: 'ASC' },
    });
  }

  private async getSettingsSetting(): Promise<AdvancedSetting | null> {
    const company = await this.getCompany();
    if (!company) {
      return null;
    }

    const category = await this.settingRepository.findOne({
      where: { companyId: company.id, code: SETTINGS_CATEGORY_CODE, nodeType: NodeType.Category },
      relations: ['children'],
    });

    return category ?? null;
  }

  private sanitizeRule(rule: Partial<CurrencyRateRuleConfig> | undefined): CurrencyRateRuleConfig {
    if (!rule) {
      return createDefaultRule();
    }

    return {
      buy: { ...createDefaultMargin(), ...(rule.buy ?? {}) },
      sale: { ...createDefaultMargin(), ...(rule.sale ?? {}) },
    };
  }

  async ensureSettingsSeeded(userId: string): Promise<void> {
    const company = await this.getCompany();
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    let category = await this.getSettingsSetting();
    if (!category) {
      category = this.settingRepository.create({
        code: SETTINGS_CATEGORY_CODE,
        label: 'Currency Rates',
        nodeType: NodeType.Category,
        createdBy: userId,
        updatedBy: userId,
        companyId: company.id,
        sortOrder: 0,
        isActive: true,
      });
      await this.settingRepository.save(category);
    }

    const child = await this.settingRepository.findOne({
      where: { parentId: category.id, code: SETTINGS_CONFIG_CODE, nodeType: NodeType.Setting },
    });

    if (!child) {
      const seed = this.settingRepository.create({
        code: SETTINGS_CONFIG_CODE,
        label: 'Currency Rates Config',
        description: 'Structured currency rates configuration',
        nodeType: NodeType.Setting,
        valueType: ValueType.Json,
        valueJson: createDefaultSettings(),
        parentId: category.id,
        companyId: category.companyId,
        createdBy: userId,
        updatedBy: userId,
        sortOrder: 0,
        isActive: true,
      });
      await this.settingRepository.save(seed);
    }
  }

  private async loadSettings(): Promise<{ category: AdvancedSetting | null; config: CurrencyRateSettings }> {
    const company = await this.getCompany();
    if (!company) {
      return { category: null, config: createDefaultSettings() };
    }

    const category = await this.getSettingsSetting();
    const child = category?.children?.find(setting => setting.code === SETTINGS_CONFIG_CODE) ?? null;
    const config = (child?.valueJson as CurrencyRateSettings | undefined) ?? createDefaultSettings();

    return {
      category,
      config: {
        defaultProvider: config.defaultProvider ?? CurrencyRateProvider.TICKER,
        roundingScale: Number.isFinite(config.roundingScale) ? config.roundingScale : 4,
        global: this.sanitizeRule(config.global),
        groups: Object.fromEntries(
          Object.entries(config.groups ?? {}).map(([key, rule]) => [key.toUpperCase(), this.sanitizeRule(rule)])
        ),
        currencyOverrides: Object.fromEntries(
          Object.entries(config.currencyOverrides ?? {}).map(([key, rule]) => [key, this.sanitizeRule(rule)])
        ),
      },
    };
  }

  private async saveSettings(config: CurrencyRateSettings, userId: string): Promise<CurrencyRateSettings> {
    let category = await this.getSettingsSetting();
    if (!category) {
      const company = await this.getCompany();
      if (!company) {
        throw new NotFoundException('Company not found');
      }

      category = this.settingRepository.create({
        code: SETTINGS_CATEGORY_CODE,
        label: 'Currency Rates',
        nodeType: NodeType.Category,
        createdBy: userId,
        updatedBy: userId,
        companyId: company.id,
        sortOrder: 0,
        isActive: true,
      });
      category = await this.settingRepository.save(category);
    }

    const payload = {
      defaultProvider: config.defaultProvider,
      roundingScale: config.roundingScale,
      global: this.sanitizeRule(config.global),
      groups: Object.fromEntries(
        Object.entries(config.groups ?? {}).map(([key, rule]) => [key.toUpperCase(), this.sanitizeRule(rule)])
      ),
      currencyOverrides: Object.fromEntries(
        Object.entries(config.currencyOverrides ?? {}).map(([key, rule]) => [key, this.sanitizeRule(rule)])
      ),
    } satisfies CurrencyRateSettings;

    const child = await this.settingRepository.findOne({
      where: { parentId: category.id, code: SETTINGS_CONFIG_CODE, nodeType: NodeType.Setting },
    });

    if (!child) {
      const created = this.settingRepository.create({
        code: SETTINGS_CONFIG_CODE,
        label: 'Currency Rates Config',
        description: 'Structured currency rates configuration',
        nodeType: NodeType.Setting,
        valueType: ValueType.Json,
        valueJson: payload,
        parentId: category.id,
        companyId: category.companyId,
        createdBy: userId,
        updatedBy: userId,
        sortOrder: 0,
        isActive: true,
      });
      await this.settingRepository.save(created);
      return payload;
    }

    child.valueType = ValueType.Json;
    child.valueJson = payload;
    child.updatedBy = userId;
    await this.settingRepository.save(child);
    return payload;
  }

  async getSettings(): Promise<CurrencyRateSettings> {
    const { config } = await this.loadSettings();
    return config;
  }

  async updateSettings(dto: SaveCurrencyRateSettingsDto, userId: string): Promise<CurrencyRateSettings> {
    await this.ensureSettingsSeeded(userId);
    return this.saveSettings(
      {
        defaultProvider: dto.defaultProvider,
        roundingScale: dto.roundingScale,
        global: dto.global,
        groups: dto.groups ?? {},
        currencyOverrides: dto.currencyOverrides ?? {},
      },
      userId,
    );
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
    if (dto.isActive !== undefined) {
      group.isActive = dto.isActive;
    }
    group.updatedBy = userId;
    return this.groupRepository.save(group);
  }

  async findGroups(): Promise<CurrencyRateGroup[]> {
    return this.groupRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findGroupById(id: string): Promise<CurrencyRateGroup> {
    const group = await this.groupRepository.findOne({ where: { id } });
    if (!group) {
      throw new NotFoundException(`Currency rate group with id ${id} not found`);
    }
    return group;
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

    if (dto.provider === CurrencyRateProvider.FOREX) {
      if (!baseRate) {
        throw new BadRequestException('baseRate is required for FOREX provider');
      }
      baseBuyRate = baseRate;
      baseSaleRate = baseRate;
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

  private round(value: number, scale: number): string {
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
    margin: CurrencyRateMarginConfig,
    scale: number,
  ): { marginAmount: string; finalRate: string } {
    const base = this.parseDecimal(baseRate);
    const marginValue = this.parseDecimal(margin.marginValue);
    let amount = 0;

    if (margin.marginType === CurrencyRateMarginType.PERCENT) {
      amount = base * (marginValue / 100);
    } else {
      amount = marginValue;
    }

    const signedAmount = margin.marginDirection === CurrencyRateMarginDirection.SUBTRACT ? -amount : amount;
    const final = base + signedAmount;

    return {
      marginAmount: this.round(amount, scale),
      finalRate: this.round(final, scale),
    };
  }

  private validateBand(finalRate: string, margin: CurrencyRateMarginConfig): { isValid: boolean; reason?: string } {
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

  async previewQuote(dto: PreviewCurrencyRateDto): Promise<CurrencyRateQuote> {
    const currency = await this.currencyRepository.findOne({
      where: { id: dto.currencyId },
      relations: ['pricingGroup'],
    });
    if (!currency) {
      throw new NotFoundException(`Currency with id ${dto.currencyId} not found`);
    }

    const { config } = await this.loadSettings();
    const override = config.currencyOverrides[dto.currencyId];
    const groupCode = currency.pricingGroup?.code?.toUpperCase();
    const groupRule = groupCode ? config.groups[groupCode] : undefined;
    const effectiveRule = override ?? groupRule ?? config.global;
    const effectiveSource: CurrencyRateQuote['effectiveSource'] = override
      ? 'currency-override'
      : groupRule
        ? 'group-default'
        : 'global-default';

    const buy = this.applyMargin(dto.baseBuyRate, effectiveRule.buy, config.roundingScale);
    const sale = this.applyMargin(dto.baseSaleRate, effectiveRule.sale, config.roundingScale);
    const buyValidation = this.validateBand(buy.finalRate, effectiveRule.buy);
    const saleValidation = this.validateBand(sale.finalRate, effectiveRule.sale);

    return {
      currencyId: currency.id,
      currencyCode: currency.currencyCode,
      provider: dto.provider,
      baseBuyRate: dto.baseBuyRate,
      baseSaleRate: dto.baseSaleRate,
      buy: {
        baseRate: dto.baseBuyRate,
        ...buy,
        minRate: effectiveRule.buy.minRate,
        maxRate: effectiveRule.buy.maxRate,
        isValid: buyValidation.isValid,
        reason: buyValidation.reason,
      },
      sale: {
        baseRate: dto.baseSaleRate,
        ...sale,
        minRate: effectiveRule.sale.minRate,
        maxRate: effectiveRule.sale.maxRate,
        isValid: saleValidation.isValid,
        reason: saleValidation.reason,
      },
      effectiveSource,
    };
  }

  async getCurrencyRateContext(currencyId: string): Promise<{
    currency: Currency;
    groupCode: string | null;
    effectiveSource: string;
    hasOverride: boolean;
  }> {
    const currency = await this.currencyRepository.findOne({
      where: { id: currencyId },
      relations: ['pricingGroup'],
    });
    if (!currency) {
      throw new NotFoundException(`Currency with id ${currencyId} not found`);
    }

    const { config } = await this.loadSettings();
    const groupCode = currency.pricingGroup?.code?.toUpperCase() ?? null;
    const hasOverride = Boolean(config.currencyOverrides[currencyId]);
    const effectiveSource = hasOverride
      ? 'currency-override'
      : groupCode && config.groups[groupCode]
        ? 'group-default'
        : 'global-default';

    return {
      currency,
      groupCode,
      effectiveSource,
      hasOverride,
    };
  }
}
