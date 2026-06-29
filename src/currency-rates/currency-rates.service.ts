import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdvancedSetting, NodeType, ValueType } from '../additional-settings/advanced-setting.entity';
import { Company } from '../company/company.entity';
import { Currency } from '../currencies/currency.entity';
import { CurrencyRateGroup } from './currency-rate-group.entity';
import { CurrencyRate } from './currency-rate.entity';
import {
  CurrencyRateMarginType,
  CurrencyRateProvider,
} from './currency-rates.enums';
import {
  CurrencyRateQuote,
  CurrencyRateSettings,
} from './currency-rates.types';
import { CreateCurrencyRateGroupDto } from './dto/create-currency-rate-group.dto';
import { UpdateCurrencyRateGroupDto } from './dto/update-currency-rate-group.dto';
import { CreateCurrencyRateDto } from './dto/create-currency-rate.dto';
import { SaveCurrencyRateSettingsDto } from './dto/save-currency-rate-settings.dto';
import { PreviewCurrencyRateDto } from './dto/preview-currency-rate.dto';

const SETTINGS_CATEGORY_CODE = 'CURRENCY_RATES';
const DEFAULT_ROUNDING_SCALE = 4;

const SETTINGS_FIELDS = {
  defaultProvider: {
    code: 'DEFAULT_PROVIDER',
    label: 'Default Provider',
    valueType: ValueType.Select,
    defaultValue: CurrencyRateProvider.TICKER,
  },
  buyMarginType: {
    code: 'BUY_MARGIN_TYPE',
    label: 'Buy Margin Type',
    valueType: ValueType.Select,
    defaultValue: CurrencyRateMarginType.PERCENT,
  },
  buyMarginValue: {
    code: 'BUY_MARGIN_VALUE',
    label: 'Buy Margin Value',
    valueType: ValueType.Decimal,
    defaultValue: '0',
  },
  buyMinRate: {
    code: 'BUY_MIN_RATE',
    label: 'Buy Min Rate',
    valueType: ValueType.Decimal,
    defaultValue: '0',
  },
  buyMaxRate: {
    code: 'BUY_MAX_RATE',
    label: 'Buy Max Rate',
    valueType: ValueType.Decimal,
    defaultValue: '999999999',
  },
  saleMarginType: {
    code: 'SALE_MARGIN_TYPE',
    label: 'Sale Margin Type',
    valueType: ValueType.Select,
    defaultValue: CurrencyRateMarginType.PERCENT,
  },
  saleMarginValue: {
    code: 'SALE_MARGIN_VALUE',
    label: 'Sale Margin Value',
    valueType: ValueType.Decimal,
    defaultValue: '0',
  },
  saleMinRate: {
    code: 'SALE_MIN_RATE',
    label: 'Sale Min Rate',
    valueType: ValueType.Decimal,
    defaultValue: '0',
  },
  saleMaxRate: {
    code: 'SALE_MAX_RATE',
    label: 'Sale Max Rate',
    valueType: ValueType.Decimal,
    defaultValue: '999999999',
  },
} as const;

type CurrencyRateSettingKey = keyof CurrencyRateSettings;

type CurrencyRateSideConfig = {
  marginType: CurrencyRateMarginType;
  marginValue: string;
  minRate: string;
  maxRate: string;
};

const createDefaultSettings = (): CurrencyRateSettings => ({
  defaultProvider: CurrencyRateProvider.TICKER,
  buyMarginType: CurrencyRateMarginType.PERCENT,
  buyMarginValue: '0',
  buyMinRate: '0',
  buyMaxRate: '999999999',
  saleMarginType: CurrencyRateMarginType.PERCENT,
  saleMarginValue: '0',
  saleMinRate: '0',
  saleMaxRate: '999999999',
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

  private async getSettingsCategory(): Promise<AdvancedSetting | null> {
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

  private normalizeCurrencyRateSettings(settings?: Partial<CurrencyRateSettings> | null): CurrencyRateSettings {
    const defaults = createDefaultSettings();
    if (!settings) {
      return defaults;
    }

    return {
      defaultProvider: Object.values(CurrencyRateProvider).includes(settings.defaultProvider as CurrencyRateProvider)
        ? (settings.defaultProvider as CurrencyRateProvider)
        : defaults.defaultProvider,
      buyMarginType: Object.values(CurrencyRateMarginType).includes(settings.buyMarginType as CurrencyRateMarginType)
        ? (settings.buyMarginType as CurrencyRateMarginType)
        : defaults.buyMarginType,
      buyMarginValue: settings.buyMarginValue ?? defaults.buyMarginValue,
      buyMinRate: settings.buyMinRate ?? defaults.buyMinRate,
      buyMaxRate: settings.buyMaxRate ?? defaults.buyMaxRate,
      saleMarginType: Object.values(CurrencyRateMarginType).includes(settings.saleMarginType as CurrencyRateMarginType)
        ? (settings.saleMarginType as CurrencyRateMarginType)
        : defaults.saleMarginType,
      saleMarginValue: settings.saleMarginValue ?? defaults.saleMarginValue,
      saleMinRate: settings.saleMinRate ?? defaults.saleMinRate,
      saleMaxRate: settings.saleMaxRate ?? defaults.saleMaxRate,
    };
  }

  private getRowValue(setting?: AdvancedSetting | null): string {
    if (!setting) {
      return '';
    }

    switch (setting.valueType) {
      case ValueType.Boolean:
        return setting.valueBoolean ? 'YES' : 'NO';
      case ValueType.Number:
        return setting.valueNumber !== null && setting.valueNumber !== undefined ? String(setting.valueNumber) : '';
      case ValueType.Decimal:
        return setting.valueDecimal !== null && setting.valueDecimal !== undefined ? String(setting.valueDecimal) : '';
      case ValueType.Date:
        return setting.valueDate ? setting.valueDate.toISOString() : '';
      case ValueType.Select:
      case ValueType.Text:
        return setting.valueText || '';
      case ValueType.Json:
        return setting.valueJson ? JSON.stringify(setting.valueJson) : '';
      default:
        return setting.valueText || '';
    }
  }

  private getSettingValue(setting?: AdvancedSetting | null): string {
    return this.getRowValue(setting);
  }

  private async upsertSettingRow(
    category: AdvancedSetting,
    key: CurrencyRateSettingKey,
    userId: string,
    value: string,
  ): Promise<void> {
    const definition = SETTINGS_FIELDS[key];
    let row = await this.settingRepository.findOne({
      where: { parentId: category.id, code: definition.code, nodeType: NodeType.Setting },
    });

    if (!row) {
      row = this.settingRepository.create({
        companyId: category.companyId,
        parentId: category.id,
        code: definition.code,
        label: definition.label,
        description: definition.label,
        nodeType: NodeType.Setting,
        sortOrder: Object.keys(SETTINGS_FIELDS).indexOf(key),
        createdBy: userId,
        updatedBy: userId,
        isActive: true,
      });
    } else {
      row.updatedBy = userId;
    }

    row.valueType = definition.valueType;
    row.valueBoolean = null;
    row.valueText = null;
    row.valueNumber = null;
    row.valueDecimal = null;
    row.valueDate = null;
    row.valueJson = null;

    const cleanValue = String(value ?? '').trim();
    if (definition.valueType === ValueType.Select) {
      row.valueText = cleanValue;
    } else if (definition.valueType === ValueType.Decimal) {
      row.valueDecimal = cleanValue ? Number.parseFloat(cleanValue) : null;
    }

    await this.settingRepository.save(row);
  }

  async ensureSettingsSeeded(userId: string): Promise<void> {
    const company = await this.getCompany();
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    let category = await this.getSettingsCategory();
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
      category = await this.settingRepository.save(category);
    }

    for (const key of Object.keys(SETTINGS_FIELDS) as CurrencyRateSettingKey[]) {
      const definition = SETTINGS_FIELDS[key];
      const row = await this.settingRepository.findOne({
        where: { parentId: category.id, code: definition.code, nodeType: NodeType.Setting },
      });

      if (!row) {
        await this.upsertSettingRow(category, key, userId, definition.defaultValue);
      }
    }
  }

  private async loadSettings(): Promise<{ category: AdvancedSetting | null; config: CurrencyRateSettings }> {
    const company = await this.getCompany();
    if (!company) {
      return { category: null, config: createDefaultSettings() };
    }

    const category = await this.getSettingsCategory();
    const rowMap = new Map(
      (category?.children ?? []).map(setting => [setting.code.toUpperCase(), setting]),
    );

    const config = this.normalizeCurrencyRateSettings({
      defaultProvider: this.getSettingValue(rowMap.get(SETTINGS_FIELDS.defaultProvider.code)) as CurrencyRateProvider,
      buyMarginType: this.getSettingValue(rowMap.get(SETTINGS_FIELDS.buyMarginType.code)) as CurrencyRateMarginType,
      buyMarginValue: this.getSettingValue(rowMap.get(SETTINGS_FIELDS.buyMarginValue.code)),
      buyMinRate: this.getSettingValue(rowMap.get(SETTINGS_FIELDS.buyMinRate.code)),
      buyMaxRate: this.getSettingValue(rowMap.get(SETTINGS_FIELDS.buyMaxRate.code)),
      saleMarginType: this.getSettingValue(rowMap.get(SETTINGS_FIELDS.saleMarginType.code)) as CurrencyRateMarginType,
      saleMarginValue: this.getSettingValue(rowMap.get(SETTINGS_FIELDS.saleMarginValue.code)),
      saleMinRate: this.getSettingValue(rowMap.get(SETTINGS_FIELDS.saleMinRate.code)),
      saleMaxRate: this.getSettingValue(rowMap.get(SETTINGS_FIELDS.saleMaxRate.code)),
    });

    return { category, config };
  }

  private async saveSettings(config: CurrencyRateSettings, userId: string): Promise<CurrencyRateSettings> {
    let category = await this.getSettingsCategory();
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

    const normalized = this.normalizeCurrencyRateSettings(config);

    await this.upsertSettingRow(category, 'defaultProvider', userId, normalized.defaultProvider);
    await this.upsertSettingRow(category, 'buyMarginType', userId, normalized.buyMarginType);
    await this.upsertSettingRow(category, 'buyMarginValue', userId, normalized.buyMarginValue);
    await this.upsertSettingRow(category, 'buyMinRate', userId, normalized.buyMinRate);
    await this.upsertSettingRow(category, 'buyMaxRate', userId, normalized.buyMaxRate);
    await this.upsertSettingRow(category, 'saleMarginType', userId, normalized.saleMarginType);
    await this.upsertSettingRow(category, 'saleMarginValue', userId, normalized.saleMarginValue);
    await this.upsertSettingRow(category, 'saleMinRate', userId, normalized.saleMinRate);
    await this.upsertSettingRow(category, 'saleMaxRate', userId, normalized.saleMaxRate);

    return normalized;
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
        buyMarginType: dto.buyMarginType,
        buyMarginValue: dto.buyMarginValue,
        buyMinRate: dto.buyMinRate,
        buyMaxRate: dto.buyMaxRate,
        saleMarginType: dto.saleMarginType,
        saleMarginValue: dto.saleMarginValue,
        saleMinRate: dto.saleMinRate,
        saleMaxRate: dto.saleMaxRate,
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
    margin: CurrencyRateSideConfig,
    scale: number,
  ): { marginAmount: string; finalRate: string } {
    const base = this.parseDecimal(baseRate);
    const marginValue = this.parseDecimal(margin.marginValue);
    const amount = margin.marginType === CurrencyRateMarginType.PERCENT
      ? base * (marginValue / 100)
      : marginValue;
    const final = base + amount;

    return {
      marginAmount: this.round(amount, scale),
      finalRate: this.round(final, scale),
    };
  }

  private validateBand(finalRate: string, margin: CurrencyRateSideConfig): { isValid: boolean; reason?: string } {
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
    const buyMargin = {
      marginType: config.buyMarginType,
      marginValue: config.buyMarginValue,
      minRate: config.buyMinRate,
      maxRate: config.buyMaxRate,
    };
    const saleMargin = {
      marginType: config.saleMarginType,
      marginValue: config.saleMarginValue,
      minRate: config.saleMinRate,
      maxRate: config.saleMaxRate,
    };

    const buy = this.applyMargin(dto.baseBuyRate, buyMargin, DEFAULT_ROUNDING_SCALE);
    const sale = this.applyMargin(dto.baseSaleRate, saleMargin, DEFAULT_ROUNDING_SCALE);
    const buyValidation = this.validateBand(buy.finalRate, buyMargin);
    const saleValidation = this.validateBand(sale.finalRate, saleMargin);

    return {
      currencyId: currency.id,
      currencyCode: currency.currencyCode,
      provider: dto.provider,
      baseBuyRate: dto.baseBuyRate,
      baseSaleRate: dto.baseSaleRate,
      buy: {
        baseRate: dto.baseBuyRate,
        ...buy,
        minRate: buyMargin.minRate,
        maxRate: buyMargin.maxRate,
        isValid: buyValidation.isValid,
        reason: buyValidation.reason,
      },
      sale: {
        baseRate: dto.baseSaleRate,
        ...sale,
        minRate: saleMargin.minRate,
        maxRate: saleMargin.maxRate,
        isValid: saleValidation.isValid,
        reason: saleValidation.reason,
      },
      effectiveSource: 'advanced-settings',
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

    const groupCode = currency.pricingGroup?.code?.toUpperCase() ?? null;

    return {
      currency,
      groupCode,
      effectiveSource: 'advanced-settings',
      hasOverride: false,
    };
  }
}
