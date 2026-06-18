import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdvancedSetting, NodeType, ValueType } from '../additional-settings/advanced-setting.entity';
import { Company } from '../company/company.entity';
import {
  DEFAULT_PASSWORD_POLICY,
  PASSWORD_POLICY_CHILDREN,
  PasswordPolicyConfig,
  PasswordPolicyResponseDto,
} from './password-policy.dto';
import {
  PasswordPolicyCodeEnum,
  PasswordValidationCodeEnum,
} from './password-policy.enum';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class PasswordPolicyService {
  constructor(
    @InjectRepository(AdvancedSetting)
    private readonly settingRepository: Repository<AdvancedSetting>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  private toSafeInteger(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed =
      typeof value === 'number' ? value : Number.parseInt(String(value), 10);

    return Number.isFinite(parsed) ? parsed : null;
  }

  private normalizeOptionalCount(value: unknown): number {
    const parsed = this.toSafeInteger(value);
    return parsed && parsed > 0 ? parsed : 0;
  }

  private normalizeRequiredCount(value: unknown, fallback: number): number {
    const parsed = this.toSafeInteger(value);
    return parsed && parsed > 0 ? parsed : fallback;
  }

  parsePolicyInteger(
    value: string,
    fieldName: string,
    allowZero = true,
    treatEmptyAsZero = false,
  ): number {
    const trimmed = value.trim();
    if (!trimmed) {
      if (treatEmptyAsZero) {
        return 0;
      }
      throw this.createPolicyException(
        PasswordValidationCodeEnum.InvalidPolicyConfig,
        `${fieldName} is required`,
        { fieldName },
      );
    }

    if (!/^-?\d+$/.test(trimmed)) {
      throw this.createPolicyException(
        PasswordValidationCodeEnum.InvalidPolicyConfig,
        `${fieldName} must be a valid integer`,
        { fieldName, value: trimmed },
      );
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (parsed < 0) {
      throw this.createPolicyException(
        PasswordValidationCodeEnum.InvalidPolicyConfig,
        `${fieldName} cannot be negative`,
        { fieldName, value: parsed },
      );
    }

    if (!allowZero && parsed === 0) {
      throw this.createPolicyException(
        PasswordValidationCodeEnum.InvalidPolicyConfig,
        `${fieldName} must be greater than zero`,
        { fieldName, value: parsed },
      );
    }

    return parsed;
  }

  private createPolicyException(
    code: PasswordValidationCodeEnum,
    message: string,
    details?: Record<string, unknown>,
  ): HttpException {
    return new HttpException(
      {
        message,
        code,
        details,
      },
      code === PasswordValidationCodeEnum.AccountLocked
        ? HttpStatus.LOCKED
        : HttpStatus.BAD_REQUEST,
    );
  }

  private getPolicyTemplate() {
    return PASSWORD_POLICY_CHILDREN;
  }

  buildConfigFromRows(rows: AdvancedSetting[]): PasswordPolicyConfig {
    const rowMap = new Map<string, AdvancedSetting>();
    for (const row of rows) {
      rowMap.set(row.code?.trim().toUpperCase(), row);
    }

    const minLength = this.normalizeRequiredCount(
      rowMap.get(PasswordPolicyCodeEnum.MinLength)?.valueNumber,
      DEFAULT_PASSWORD_POLICY.minLength,
    );
    const maxLength = this.normalizeRequiredCount(
      rowMap.get(PasswordPolicyCodeEnum.MaxLength)?.valueNumber,
      DEFAULT_PASSWORD_POLICY.maxLength,
    );
    const minSpecialCharCount = this.normalizeOptionalCount(
      rowMap.get(PasswordPolicyCodeEnum.MinSpecialCharCount)?.valueNumber,
    );
    const minNumericCount = this.normalizeOptionalCount(
      rowMap.get(PasswordPolicyCodeEnum.MinNumericCount)?.valueNumber,
    );
    const minAlphaCount = this.normalizeOptionalCount(
      rowMap.get(PasswordPolicyCodeEnum.MinAlphaCount)?.valueNumber,
    );
    const maxInvalidAttempts = this.normalizeOptionalCount(
      rowMap.get(PasswordPolicyCodeEnum.MaxInvalidAttempts)?.valueNumber,
    );

    return {
      minLength,
      maxLength,
      minSpecialCharCount,
      minNumericCount,
      minAlphaCount,
      maxInvalidAttempts,
    };
  }

  validatePolicyConfig(config: PasswordPolicyConfig): PasswordPolicyConfig {
    const normalized: PasswordPolicyConfig = {
      minLength: this.normalizeRequiredCount(config.minLength, DEFAULT_PASSWORD_POLICY.minLength),
      maxLength: this.normalizeRequiredCount(config.maxLength, DEFAULT_PASSWORD_POLICY.maxLength),
      minSpecialCharCount: this.normalizeOptionalCount(config.minSpecialCharCount),
      minNumericCount: this.normalizeOptionalCount(config.minNumericCount),
      minAlphaCount: this.normalizeOptionalCount(config.minAlphaCount),
      maxInvalidAttempts: this.normalizeOptionalCount(config.maxInvalidAttempts),
    };

    if (normalized.minLength > normalized.maxLength) {
      throw this.createPolicyException(
        PasswordValidationCodeEnum.InvalidPolicyConfig,
        'Minimum password length cannot exceed maximum password length',
        {
          minLength: normalized.minLength,
          maxLength: normalized.maxLength,
        },
      );
    }

    for (const [key, value] of [
      ['minSpecialCharCount', normalized.minSpecialCharCount],
      ['minNumericCount', normalized.minNumericCount],
      ['minAlphaCount', normalized.minAlphaCount],
    ] as const) {
      if (value > normalized.maxLength) {
        throw this.createPolicyException(
          PasswordValidationCodeEnum.InvalidPolicyConfig,
          `${key} cannot exceed maximum password length`,
          {
            [key]: value,
            maxLength: normalized.maxLength,
          },
        );
      }
    }

    return normalized;
  }

  async getCompany(): Promise<Company | null> {
    return this.companyRepository.findOne({
      order: { createdAt: 'ASC' },
    });
  }

  async getPasswordPolicyEntity(): Promise<AdvancedSetting | null> {
    const rows = await this.settingRepository.find({
      where: {
        code: PasswordPolicyCodeEnum.Policy,
        nodeType: NodeType.Category,
      },
      relations: ['children'],
      order: {
        createdAt: 'ASC',
      },
    });
    return rows[0] || null;
  }

  async ensurePasswordPolicySeed(): Promise<AdvancedSetting | null> {
    const company = await this.getCompany();
    if (!company) {
      return null;
    }

    const existingCategory = await this.settingRepository.findOne({
      where: {
        companyId: company.id,
        code: PasswordPolicyCodeEnum.Policy,
        nodeType: NodeType.Category,
      },
      relations: ['children'],
    });

    if (existingCategory) {
      const missingChildren = this.getPolicyTemplate().filter(
        template =>
          !(existingCategory.children || []).some(
            child => child.code?.trim().toUpperCase() === template.code,
          ),
      );

      for (const missing of missingChildren) {
        const sortOrder = this.getPolicyTemplate().findIndex(
          template => template.code === missing.code,
        );
        const child = this.settingRepository.create({
          companyId: company.id,
          parentId: existingCategory.id,
          code: missing.code,
          label: missing.label,
          description: missing.label,
          nodeType: NodeType.Setting,
          valueType: ValueType.Number,
          valueNumber: missing.defaultValue,
          sortOrder: sortOrder >= 0 ? sortOrder : 0,
          createdBy: SYSTEM_USER_ID,
          updatedBy: SYSTEM_USER_ID,
        });
        await this.settingRepository.save(child);
      }

      return this.settingRepository.findOne({
        where: {
          id: existingCategory.id,
        },
        relations: ['children'],
      });
    }

    const category = this.settingRepository.create({
      companyId: company.id,
      code: PasswordPolicyCodeEnum.Policy,
      label: 'Password Policy',
      nodeType: NodeType.Category,
      createdBy: SYSTEM_USER_ID,
      updatedBy: SYSTEM_USER_ID,
    });
    const savedCategory = await this.settingRepository.save(category);

    for (const [index, template] of this.getPolicyTemplate().entries()) {
      const child = this.settingRepository.create({
        companyId: company.id,
        parentId: savedCategory.id,
        code: template.code,
        label: template.label,
        description: template.label,
        nodeType: NodeType.Setting,
        valueType: ValueType.Number,
        valueNumber: template.defaultValue,
        sortOrder: index,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
      await this.settingRepository.save(child);
    }

    return this.settingRepository.findOne({
      where: { id: savedCategory.id },
      relations: ['children'],
    });
  }

  async getPasswordPolicy(): Promise<PasswordPolicyResponseDto> {
    const category = await this.getPasswordPolicyEntity();
    if (!category) {
      return PasswordPolicyResponseDto.fromConfig(DEFAULT_PASSWORD_POLICY);
    }

    const config = this.validatePolicyConfig(this.buildConfigFromRows(category.children || []));
    return PasswordPolicyResponseDto.fromConfig(config);
  }

  validatePassword(password: string, policy: PasswordPolicyConfig): void {
    const normalized = this.validatePolicyConfig(policy);
    const passwordLength = password.length;

    if (passwordLength < normalized.minLength) {
      throw this.createPolicyException(
        PasswordValidationCodeEnum.TooShort,
        `Password must be at least ${normalized.minLength} characters long`,
        { minLength: normalized.minLength },
      );
    }

    if (passwordLength > normalized.maxLength) {
      throw this.createPolicyException(
        PasswordValidationCodeEnum.TooLong,
        `Password must be at most ${normalized.maxLength} characters long`,
        { maxLength: normalized.maxLength },
      );
    }

    const specialCharCount = (password.match(/[^A-Za-z0-9]/g) || []).length;
    const numericCount = (password.match(/[0-9]/g) || []).length;
    const alphaCount = (password.match(/[A-Za-z]/g) || []).length;

    if (normalized.minSpecialCharCount > 0 && specialCharCount < normalized.minSpecialCharCount) {
      throw this.createPolicyException(
        PasswordValidationCodeEnum.MissingSpecialChars,
        `Password must contain at least ${normalized.minSpecialCharCount} special character(s)`,
        { minSpecialCharCount: normalized.minSpecialCharCount },
      );
    }

    if (normalized.minNumericCount > 0 && numericCount < normalized.minNumericCount) {
      throw this.createPolicyException(
        PasswordValidationCodeEnum.MissingNumericChars,
        `Password must contain at least ${normalized.minNumericCount} numeric character(s)`,
        { minNumericCount: normalized.minNumericCount },
      );
    }

    if (normalized.minAlphaCount > 0 && alphaCount < normalized.minAlphaCount) {
      throw this.createPolicyException(
        PasswordValidationCodeEnum.MissingAlphaChars,
        `Password must contain at least ${normalized.minAlphaCount} alphabetic character(s)`,
        { minAlphaCount: normalized.minAlphaCount },
      );
    }
  }

  lockedAccountException(): HttpException {
    return this.createPolicyException(
      PasswordValidationCodeEnum.AccountLocked,
      'Account is locked because too many invalid login attempts were made',
    );
  }
}
