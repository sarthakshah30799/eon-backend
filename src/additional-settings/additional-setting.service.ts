import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdvancedSetting, NodeType, ValueType } from './advanced-setting.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { PasswordPolicyService } from '../password-policy/password-policy.service';
import { PasswordPolicyCodeEnum } from '../password-policy/password-policy.enum';
import { PASSWORD_POLICY_CHILDREN, PasswordPolicyConfig } from '../password-policy/password-policy.dto';
import { SessionPolicyService } from '../session-policy/session-policy.service';
import { SessionPolicyCodeEnum } from '../session-policy/session-policy.enum';
import { SESSION_POLICY_CHILDREN, SessionPolicyConfig } from '../session-policy/session-policy.dto';
import {
  TransactionTypeProfileEnum,
  type TransactionTypeProfile,
} from '../transactions/transactions.enums';

type PolicyCreateContext = {
  dto: CreateCategoryDto;
  savedCategory: AdvancedSetting;
  userId: string;
};

type PolicyUpdateContext = {
  categoryId: string;
  subcategoryId: string;
  setting: AdvancedSetting;
  dto: UpdateSubcategoryDto;
  userId: string;
};

type PolicyHandler = {
  createChildren: (context: PolicyCreateContext) => Promise<void>;
  updateSubcategory: (context: PolicyUpdateContext) => Promise<void>;
};

const normalizeCode = (code?: string | null) => String(code ?? '').trim().toUpperCase();
const TRANSACTION_NUMBERING_CODE_LIST = Object.values(
  TransactionTypeProfileEnum
) as TransactionTypeProfile[];
const TRANSACTION_NUMBERING_CODES = new Set<TransactionTypeProfile>(
  TRANSACTION_NUMBERING_CODE_LIST
);
const COMMON_PURCHASE_NUMBER_SERIES_CODES = [
  'PURCHASE_CORPORATE',
  'PURCHASE_INDIVIDUAL',
] as const;

const isTransactionTypeProfile = (
  code: string
): code is TransactionTypeProfile =>
  TRANSACTION_NUMBERING_CODES.has(code as TransactionTypeProfile);

@Injectable()
export class AdditionalSettingService {
  constructor(
    @InjectRepository(AdvancedSetting)
    private readonly settingRepository: Repository<AdvancedSetting>,
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly sessionPolicyService: SessionPolicyService,
  ) { }

  private parseAndSetValue(setting: AdvancedSetting, value: string, valueType: ValueType) {
    setting.valueType = valueType;
    setting.valueBoolean = null;
    setting.valueText = null;
    setting.valueNumber = null;
    setting.valueDecimal = null;
    setting.valueDate = null;
    setting.valueJson = null;

    const cleanVal = value.trim();
    if (!cleanVal) {
      return;
    }

    switch (valueType) {
      case ValueType.Boolean:
        setting.valueBoolean = cleanVal.toUpperCase() === 'YES' || cleanVal.toLowerCase() === 'true';
        break;
      case ValueType.Number:
        setting.valueNumber = parseInt(cleanVal, 10);
        break;
      case ValueType.Decimal:
        setting.valueDecimal = parseFloat(cleanVal);
        break;
      case ValueType.Date:
        setting.valueDate = new Date(cleanVal);
        break;
      case ValueType.Select:
        setting.valueText = cleanVal;
        break;
      case ValueType.Json:
        try {
          setting.valueJson = JSON.parse(cleanVal);
        } catch {
          setting.valueJson = cleanVal;
        }
        break;
      case ValueType.Text:
      default:
        setting.valueText = cleanVal;
        break;
    }
  }

  private validateTransactionNumberingValue(
    categoryCode: string,
    subcategoryCode: string,
    value: string,
  ) {
    if (normalizeCode(categoryCode) !== 'TRANSACTION_NUMBERING') {
      return;
    }

    const normalizedSubcategoryCode = normalizeCode(subcategoryCode);
    if (!isTransactionTypeProfile(normalizedSubcategoryCode)) {
      return;
    }

    const cleanValue = String(value ?? '').trim();
    if (!cleanValue) {
      return;
    }

    if (!/^\d+$/.test(cleanValue)) {
      throw new BadRequestException(
        'Transaction numbering value must contain digits only',
      );
    }

    if (cleanValue.length !== 9) {
      throw new BadRequestException(
        'Transaction numbering series must be exactly 9 digits',
      );
    }
  }

  private resolveTransactionNumberSeriesCodes(seriesCode: string): string[] {
    const normalizedSeriesCode = normalizeCode(seriesCode);

    if (
      normalizedSeriesCode === 'PURCHASE_CORPORATE' ||
      normalizedSeriesCode === 'PURCHASE_INDIVIDUAL' ||
      normalizedSeriesCode === 'SALE_CORPORATE' ||
      normalizedSeriesCode === 'SALE_INDIVIDUAL'
    ) {
      return [...COMMON_PURCHASE_NUMBER_SERIES_CODES];
    }

    return [normalizedSeriesCode];
  }

  private parseSeriesValue(setting: AdvancedSetting): number {
    const value = setting.valueNumber ?? Number(setting.valueText ?? NaN);
    return Number.isFinite(value) ? value : NaN;
  }

  private getPolicyHandlers(): Record<string, PolicyHandler> {
    return {
      [PasswordPolicyCodeEnum.Policy]: {
        createChildren: async ({ dto, savedCategory, userId }) => {
          const createdChildren: AdvancedSetting[] = [];

          for (const [index, sub] of (dto.subcategories || []).entries()) {
            const code = normalizeCode(sub.code) as PasswordPolicyCodeEnum;
            let numericValue: number;

            if (code === PasswordPolicyCodeEnum.MinLength) {
              numericValue = this.passwordPolicyService.parsePolicyInteger(sub.value, 'Minimum Length', false);
            } else if (code === PasswordPolicyCodeEnum.MaxLength) {
              numericValue = this.passwordPolicyService.parsePolicyInteger(sub.value, 'Maximum Length', false);
            } else if (code === PasswordPolicyCodeEnum.MinSpecialCharCount) {
              numericValue = this.passwordPolicyService.parsePolicyInteger(sub.value, 'Minimum Special Characters', true);
            } else if (code === PasswordPolicyCodeEnum.MinNumericCount) {
              numericValue = this.passwordPolicyService.parsePolicyInteger(sub.value, 'Minimum Numeric Characters', true);
            } else if (code === PasswordPolicyCodeEnum.MinAlphaCount) {
              numericValue = this.passwordPolicyService.parsePolicyInteger(sub.value, 'Minimum Alpha Characters', true);
            } else if (code === PasswordPolicyCodeEnum.MaxInvalidAttempts) {
              numericValue = this.passwordPolicyService.parsePolicyInteger(sub.value, 'Maximum Invalid Attempts', true);
            } else {
              numericValue = parseInt(sub.value, 10);
            }

            const child = this.settingRepository.create({
              parentId: savedCategory.id,
              code,
              label: sub.title.trim(),
              description: sub.title.trim(),
              nodeType: NodeType.Setting,
              sortOrder: index,
              createdBy: userId,
              updatedBy: userId,
            });

            this.parseAndSetValue(child, String(numericValue), ValueType.Number);
            createdChildren.push(child);
          }

          if (createdChildren.length > 0) {
            this.passwordPolicyService.validatePolicyConfig(
              this.passwordPolicyService.buildConfigFromRows(createdChildren),
            );
          }

          for (const child of createdChildren) {
            await this.settingRepository.save(child);
          }
        },
        updateSubcategory: async ({ categoryId, subcategoryId, setting, dto, userId }) => {
          const children = await this.settingRepository.find({
            where: { parentId: categoryId, nodeType: NodeType.Setting },
          });

          const numericValue = this.passwordPolicyService.parsePolicyInteger(
            dto.value,
            setting.label || setting.code,
            true,
            true,
          );

          const merged = children.map(child =>
            child.id === subcategoryId
              ? {
                ...child,
                valueNumber: numericValue,
              }
              : child,
          );

          this.passwordPolicyService.validatePolicyConfig(
            this.passwordPolicyService.buildConfigFromRows(merged),
          );

          setting.description = setting.description || dto.description.trim();
          setting.updatedBy = userId;
          this.parseAndSetValue(setting, String(numericValue), ValueType.Number);
        },
      },
      [SessionPolicyCodeEnum.Policy]: {
        createChildren: async ({ dto, savedCategory, userId }) => {
          const createdChildren: AdvancedSetting[] = [];

          for (const [index, sub] of (dto.subcategories || []).entries()) {
            const code = normalizeCode(sub.code) as SessionPolicyCodeEnum;
            const child = this.settingRepository.create({
              parentId: savedCategory.id,
              code,
              label: sub.title.trim(),
              description: sub.title.trim(),
              nodeType: NodeType.Setting,
              sortOrder: index,
              createdBy: userId,
              updatedBy: userId,
            });

            if (code === SessionPolicyCodeEnum.AllowMultipleLogin) {
              const boolVal = this.sessionPolicyService.parsePolicyBoolean(sub.value, 'Allow Multiple Login');
              this.parseAndSetValue(child, boolVal ? 'YES' : 'NO', ValueType.Boolean);
            } else if (code === SessionPolicyCodeEnum.IdleTimeoutSeconds) {
              const numVal = this.sessionPolicyService.parsePolicyInteger(sub.value, 'Idle Timeout Seconds', true);
              this.parseAndSetValue(child, String(numVal), ValueType.Number);
            } else {
              this.parseAndSetValue(child, sub.value, sub.valueType);
            }

            createdChildren.push(child);
          }

          if (createdChildren.length > 0) {
            this.sessionPolicyService.validatePolicyConfig(
              this.sessionPolicyService.buildConfigFromRows(createdChildren),
            );
          }

          for (const child of createdChildren) {
            await this.settingRepository.save(child);
          }
        },
        updateSubcategory: async ({ categoryId, subcategoryId, setting, dto, userId }) => {
          const children = await this.settingRepository.find({
            where: { parentId: categoryId, nodeType: NodeType.Setting },
          });

          if (normalizeCode(setting.code) === SessionPolicyCodeEnum.AllowMultipleLogin) {
            const booleanValue = this.sessionPolicyService.parsePolicyBoolean(
              dto.value,
              setting.label || setting.code,
            );

            const merged = children.map(child =>
              child.id === subcategoryId
                ? {
                  ...child,
                  valueBoolean: booleanValue,
                }
                : child,
            );

            this.sessionPolicyService.validatePolicyConfig(
              this.sessionPolicyService.buildConfigFromRows(merged),
            );

            setting.description = setting.description || dto.description.trim();
            setting.updatedBy = userId;
            this.parseAndSetValue(setting, booleanValue ? 'YES' : 'NO', ValueType.Boolean);
            return;
          }

          const numericValue = this.sessionPolicyService.parsePolicyInteger(
            dto.value,
            setting.label || setting.code,
            true,
            true,
          );

          const merged = children.map(child =>
            child.id === subcategoryId
              ? {
                ...child,
                valueNumber: numericValue,
              }
              : child,
          );

          this.sessionPolicyService.validatePolicyConfig(
            this.sessionPolicyService.buildConfigFromRows(merged),
          );

          setting.description = setting.description || dto.description.trim();
          setting.updatedBy = userId;
          this.parseAndSetValue(setting, String(numericValue), ValueType.Number);
        },
      },
    };
  }

  private getPolicyHandler(categoryCode?: string | null): PolicyHandler | null {
    return this.getPolicyHandlers()[normalizeCode(categoryCode)] ?? null;
  }

  private getFinancialYearSuffix(referenceDate: Date): string {
    const year = referenceDate.getFullYear();
    const fiscalYear = referenceDate.getMonth() >= 3 ? year : year - 1;
    return String(fiscalYear % 100).padStart(2, '0');
  }

  private normalizeReferenceSegment(value: string): string {
    return String(value ?? '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  }

  private buildTransactionNumber(
    branchCode: string,
    currentSeries: number,
    referenceDate: Date,
  ): string {
    const branchSegment = this.normalizeReferenceSegment(branchCode);
    const availableSeriesDigits = Math.max(1, Math.min(9, 15 - branchSegment.length - 2));
    const series = String(Math.trunc(currentSeries)).padStart(availableSeriesDigits, '0');
    return `${branchSegment}${this.getFinancialYearSuffix(referenceDate)}${series}`;
  }

  async reserveTransactionNumber(
    seriesCode: string,
    branchCode: string,
    referenceDate = new Date(),
  ): Promise<string> {
    const normalizedSeriesCodes = this.resolveTransactionNumberSeriesCodes(seriesCode);
    const normalizedBranchCode = this.normalizeReferenceSegment(branchCode);

    if (!normalizedBranchCode) {
      throw new NotFoundException('Branch code is required to generate transaction number');
    }

    if (!normalizedSeriesCodes.length) {
      throw new NotFoundException('Transaction series code is required');
    }

    return this.settingRepository.manager.transaction(async manager => {
      const settingRepository = manager.getRepository(AdvancedSetting);
      const category = await settingRepository.findOne({
        where: {
          code: 'TRANSACTION_NUMBERING',
          nodeType: NodeType.Category,
        },
      });

      if (!category) {
        throw new NotFoundException(
          'Transaction numbering settings are not configured',
        );
      }

      const seriesSettings = await settingRepository
        .createQueryBuilder('setting')
        .where('setting.parentId = :parentId', { parentId: category.id })
        .andWhere('setting.nodeType = :nodeType', { nodeType: NodeType.Setting })
        .andWhere('UPPER(setting.code) IN (:...codes)', {
          codes: normalizedSeriesCodes.map(code => normalizeCode(code)),
        })
        .setLock('pessimistic_write')
        .getMany();

      if (!seriesSettings.length) {
        throw new NotFoundException(
          `Transaction number series setting for ${normalizedSeriesCodes.join(', ')} is not configured`,
        );
      }

      const seriesValues = seriesSettings
        .map(setting => this.parseSeriesValue(setting))
        .filter(value => Number.isFinite(value) && value >= 0);
      const currentSeries = Math.max(...seriesValues);
      if (!Number.isFinite(currentSeries) || currentSeries < 0) {
        throw new NotFoundException(
          `Transaction number series for ${normalizedSeriesCodes.join(', ')} is invalid`,
        );
      }

      const generated = this.buildTransactionNumber(
        normalizedBranchCode,
        currentSeries,
        referenceDate,
      );
      if (generated.length > 15) {
        throw new NotFoundException(
          'Generated transaction number exceeds the maximum allowed length',
        );
      }

      const nextSeries = Math.trunc(currentSeries) + 1;
      for (const seriesSetting of seriesSettings) {
        seriesSetting.valueNumber = nextSeries;
        seriesSetting.valueText = null;
        seriesSetting.valueDate = null;
        seriesSetting.valueJson = null;
        seriesSetting.valueBoolean = null;
      }
      await settingRepository.save(seriesSettings);

      return generated;
    });
  }

  async getTransactionNumberPreview(
    seriesCode: string,
    branchCode: string,
    referenceDate = new Date(),
  ): Promise<{ nextNumber: string }> {
    const normalizedSeriesCodes = this.resolveTransactionNumberSeriesCodes(seriesCode);
    const normalizedBranchCode = this.normalizeReferenceSegment(branchCode);

    if (!normalizedBranchCode) {
      throw new NotFoundException('Branch code is required to generate transaction number');
    }

    if (!normalizedSeriesCodes.length) {
      throw new NotFoundException('Transaction series code is required');
    }

    const category = await this.settingRepository.findOne({
      where: {
        code: 'TRANSACTION_NUMBERING',
        nodeType: NodeType.Category,
      },
    });

    if (!category) {
      throw new NotFoundException(
        'Transaction numbering settings are not configured',
      );
    }

    const seriesSettings = await this.settingRepository
      .createQueryBuilder('setting')
      .where('setting.parentId = :parentId', { parentId: category.id })
      .andWhere('setting.nodeType = :nodeType', { nodeType: NodeType.Setting })
      .andWhere('UPPER(setting.code) IN (:...codes)', {
        codes: normalizedSeriesCodes.map(code => normalizeCode(code)),
      })
      .getMany();

    if (!seriesSettings.length) {
      throw new NotFoundException(
        `Transaction number series setting for ${normalizedSeriesCodes.join(', ')} is not configured`,
      );
    }

    const seriesValues = seriesSettings
      .map(setting => this.parseSeriesValue(setting))
      .filter(value => Number.isFinite(value) && value >= 0);
    const currentSeries = Math.max(...seriesValues);
    if (!Number.isFinite(currentSeries) || currentSeries < 0) {
      throw new NotFoundException(
        `Transaction number series for ${normalizedSeriesCodes.join(', ')} is invalid`,
      );
    }

    const nextNumber = this.buildTransactionNumber(
      normalizedBranchCode,
      currentSeries,
      referenceDate,
    );

    if (nextNumber.length > 15) {
      throw new NotFoundException(
        'Generated transaction number exceeds the maximum allowed length',
      );
    }

    return { nextNumber };
  }

  async getSettingTextValue(
    categoryCode: string,
    subcategoryCode: string,
  ): Promise<string | null> {
    const setting = await this.settingRepository.findOne({
      where: {
        code: normalizeCode(subcategoryCode),
        nodeType: NodeType.Setting,
      },
    });

    if (!setting) {
      return null;
    }

    const parent = setting.parentId
      ? await this.settingRepository.findOne({
          where: {
            id: setting.parentId,
            code: normalizeCode(categoryCode),
            nodeType: NodeType.Category,
          },
        })
      : null;

    if (!parent) {
      return null;
    }

    return (
      setting.valueText?.trim() ||
      setting.valueDecimal?.toString() ||
      setting.valueNumber?.toString() ||
      null
    );
  }

  async findAll(): Promise<AdvancedSetting[]> {
    return this.settingRepository.find({
      where: { nodeType: NodeType.Category },
      relations: ['children'],
      order: {
        sortOrder: 'ASC',
        label: 'ASC',
        children: {
          sortOrder: 'ASC',
          label: 'ASC',
        },
      },
    });
  }

  async create(dto: CreateCategoryDto, userId: string): Promise<AdvancedSetting> {
    const categoryCode = normalizeCode(dto.code);
    const existing = await this.settingRepository.findOne({
      where: { code: categoryCode, nodeType: NodeType.Category },
    });

    if (existing) {
      throw new ConflictException(`Category with code ${categoryCode} already exists`);
    }

    const category = this.settingRepository.create({
      code: categoryCode,
      label: dto.title.trim(),
      nodeType: NodeType.Category,
      createdBy: userId,
      updatedBy: userId,
    });

    const savedCategory = await this.settingRepository.save(category);
    const handler = this.getPolicyHandler(savedCategory.code);

    try {
      if (handler) {
        await handler.createChildren({
          dto,
          savedCategory,
          userId,
        });
      } else if (dto.subcategories?.length) {
        for (const sub of dto.subcategories) {
          const child = this.settingRepository.create({
            parentId: savedCategory.id,
            code: normalizeCode(sub.code),
            label: sub.title.trim(),
            description: sub.title.trim(),
            nodeType: NodeType.Setting,
            createdBy: userId,
            updatedBy: userId,
          });
          this.validateTransactionNumberingValue(savedCategory.code, sub.code, sub.value);
          this.parseAndSetValue(child, sub.value, sub.valueType);
          await this.settingRepository.save(child);
        }
      }
    } catch (error) {
      await this.settingRepository.delete({ id: savedCategory.id });
      throw error;
    }

    if (normalizeCode(savedCategory.code) === SessionPolicyCodeEnum.Policy) {
      this.sessionPolicyService.invalidateCache();
    }

    return this.settingRepository.findOne({
      where: { id: savedCategory.id },
      relations: ['children'],
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, userId: string): Promise<AdvancedSetting> {
    const category = await this.settingRepository.findOne({
      where: { id, nodeType: NodeType.Category },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    category.label = dto.title.trim();
    category.updatedBy = userId;
    await this.settingRepository.save(category);

    const isPasswordPolicy = normalizeCode(category.code) === PasswordPolicyCodeEnum.Policy;
    const isSessionPolicy = normalizeCode(category.code) === SessionPolicyCodeEnum.Policy;

    if (dto.subcategories) {
      const currentChildren = await this.settingRepository.find({
        where: { parentId: id, nodeType: NodeType.Setting },
      });

      const incomingCodes = new Set(dto.subcategories.map(sub => normalizeCode(sub.code)));

      // Delete children not in incoming request
      for (const child of currentChildren) {
        if (!incomingCodes.has(normalizeCode(child.code))) {
          await this.settingRepository.delete({ id: child.id });
        }
      }

      const updatedChildren: AdvancedSetting[] = [];

      // Validate and instantiate/update incoming children
      for (const [index, sub] of dto.subcategories.entries()) {
        const code = normalizeCode(sub.code);
        let child = currentChildren.find(c => normalizeCode(c.code) === code);
        if (!child) {
          child = this.settingRepository.create({
            parentId: category.id,
            code,
            nodeType: NodeType.Setting,
            createdBy: userId,
          });
        }

        child.label = sub.title.trim();
        child.description = sub.title.trim();
        child.updatedBy = userId;
        child.sortOrder = index;

        if (isPasswordPolicy) {
          let numericValue: number;
          const pCode = code as PasswordPolicyCodeEnum;
          if (pCode === PasswordPolicyCodeEnum.MinLength) {
            numericValue = this.passwordPolicyService.parsePolicyInteger(sub.value, 'Minimum Length', false);
          } else if (pCode === PasswordPolicyCodeEnum.MaxLength) {
            numericValue = this.passwordPolicyService.parsePolicyInteger(sub.value, 'Maximum Length', false);
          } else if (pCode === PasswordPolicyCodeEnum.MinSpecialCharCount) {
            numericValue = this.passwordPolicyService.parsePolicyInteger(sub.value, 'Minimum Special Characters', true);
          } else if (pCode === PasswordPolicyCodeEnum.MinNumericCount) {
            numericValue = this.passwordPolicyService.parsePolicyInteger(sub.value, 'Minimum Numeric Characters', true);
          } else if (pCode === PasswordPolicyCodeEnum.MinAlphaCount) {
            numericValue = this.passwordPolicyService.parsePolicyInteger(sub.value, 'Minimum Alpha Characters', true);
          } else if (pCode === PasswordPolicyCodeEnum.MaxInvalidAttempts) {
            numericValue = this.passwordPolicyService.parsePolicyInteger(sub.value, 'Maximum Invalid Attempts', true);
          } else {
            numericValue = parseInt(sub.value, 10);
          }
          this.parseAndSetValue(child, String(numericValue), ValueType.Number);
        } else if (isSessionPolicy) {
          const sCode = code as SessionPolicyCodeEnum;
          if (sCode === SessionPolicyCodeEnum.AllowMultipleLogin) {
            const boolVal = this.sessionPolicyService.parsePolicyBoolean(sub.value, 'Allow Multiple Login');
            this.parseAndSetValue(child, boolVal ? 'YES' : 'NO', ValueType.Boolean);
          } else if (sCode === SessionPolicyCodeEnum.IdleTimeoutSeconds) {
            const numVal = this.sessionPolicyService.parsePolicyInteger(sub.value, 'Idle Timeout Seconds', true);
            this.parseAndSetValue(child, String(numVal), ValueType.Number);
          } else {
            this.parseAndSetValue(child, sub.value, sub.valueType);
          }
        } else {
          this.validateTransactionNumberingValue(category.code, code, sub.value);
          this.parseAndSetValue(child, sub.value, sub.valueType);
        }

        updatedChildren.push(child);
      }

      // Run overall policy configuration check
      if (isPasswordPolicy && updatedChildren.length > 0) {
        this.passwordPolicyService.validatePolicyConfig(
          this.passwordPolicyService.buildConfigFromRows(updatedChildren),
        );
      } else if (isSessionPolicy && updatedChildren.length > 0) {
        this.sessionPolicyService.validatePolicyConfig(
          this.sessionPolicyService.buildConfigFromRows(updatedChildren),
        );
      }

      // Save all updated/created children
      for (const child of updatedChildren) {
        await this.settingRepository.save(child);
      }
    }

    if (isSessionPolicy) {
      this.sessionPolicyService.invalidateCache();
    }

    return this.settingRepository.findOne({
      where: { id },
      relations: ['children'],
    });
  }

  async updateSubcategory(
    categoryId: string,
    subcategoryId: string,
    dto: UpdateSubcategoryDto,
    userId: string,
  ): Promise<AdvancedSetting> {
    const setting = await this.settingRepository.findOne({
      where: { id: subcategoryId, parentId: categoryId, nodeType: NodeType.Setting },
    });

    if (!setting) {
      throw new NotFoundException('Setting not found under the specified category');
    }

    const category = await this.settingRepository.findOne({
      where: { id: categoryId, nodeType: NodeType.Category },
    });

    const handler = this.getPolicyHandler(category?.code);

    if (handler) {
      await handler.updateSubcategory({
        categoryId,
        subcategoryId,
        setting,
        dto,
        userId,
      });
    } else {
      this.validateTransactionNumberingValue(category?.code ?? '', setting.code, dto.value);
      setting.description = dto.description.trim();
      setting.updatedBy = userId;
      this.parseAndSetValue(setting, dto.value, setting.valueType);
    }

    await this.settingRepository.save(setting);

    if (normalizeCode(category?.code) === SessionPolicyCodeEnum.Policy) {
      this.sessionPolicyService.invalidateCache();
    }

    const refreshedCategory = await this.settingRepository.findOne({
      where: { id: categoryId },
      relations: ['children'],
    });

    if (!refreshedCategory) {
      throw new NotFoundException('Category not found');
    }

    return refreshedCategory;
  }
}
