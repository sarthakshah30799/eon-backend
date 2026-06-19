import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

type PolicyCreateContext = {
  dto: CreateCategoryDto;
  savedCategory: AdvancedSetting;
  companyId: string;
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

@Injectable()
export class AdditionalSettingService {
  constructor(
    @InjectRepository(AdvancedSetting)
    private readonly settingRepository: Repository<AdvancedSetting>,
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly sessionPolicyService: SessionPolicyService,
  ) {}

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

  private getPolicyHandlers(): Record<string, PolicyHandler> {
    return {
      [PasswordPolicyCodeEnum.Policy]: {
        createChildren: async ({ dto, savedCategory, companyId, userId }) => {
          const findIncomingValue = (code: PasswordPolicyCodeEnum) => {
            const incoming = (dto.subcategories || []).find(
              sub => normalizeCode(sub.code) === code,
            );
            return incoming?.value ?? '';
          };

          const proposedPolicy: PasswordPolicyConfig = {
            minLength: this.passwordPolicyService.parsePolicyInteger(
              findIncomingValue(PasswordPolicyCodeEnum.MinLength),
              'Minimum Length',
              false,
            ),
            maxLength: this.passwordPolicyService.parsePolicyInteger(
              findIncomingValue(PasswordPolicyCodeEnum.MaxLength),
              'Maximum Length',
              false,
            ),
            minSpecialCharCount: this.passwordPolicyService.parsePolicyInteger(
              findIncomingValue(PasswordPolicyCodeEnum.MinSpecialCharCount),
              'Minimum Special Characters',
              true,
              true,
            ),
            minNumericCount: this.passwordPolicyService.parsePolicyInteger(
              findIncomingValue(PasswordPolicyCodeEnum.MinNumericCount),
              'Minimum Numeric Characters',
              true,
              true,
            ),
            minAlphaCount: this.passwordPolicyService.parsePolicyInteger(
              findIncomingValue(PasswordPolicyCodeEnum.MinAlphaCount),
              'Minimum Alpha Characters',
              true,
              true,
            ),
            maxInvalidAttempts: this.passwordPolicyService.parsePolicyInteger(
              findIncomingValue(PasswordPolicyCodeEnum.MaxInvalidAttempts),
              'Maximum Invalid Attempts',
              true,
              true,
            ),
          };

          this.passwordPolicyService.validatePolicyConfig(proposedPolicy);

          for (const [index, template] of PASSWORD_POLICY_CHILDREN.entries()) {
            const numericValue =
              template.code === PasswordPolicyCodeEnum.MinLength
                ? proposedPolicy.minLength
                : template.code === PasswordPolicyCodeEnum.MaxLength
                  ? proposedPolicy.maxLength
                  : template.code === PasswordPolicyCodeEnum.MinSpecialCharCount
                    ? proposedPolicy.minSpecialCharCount
                    : template.code === PasswordPolicyCodeEnum.MinNumericCount
                      ? proposedPolicy.minNumericCount
                      : template.code === PasswordPolicyCodeEnum.MinAlphaCount
                        ? proposedPolicy.minAlphaCount
                        : proposedPolicy.maxInvalidAttempts;

            const child = this.settingRepository.create({
              companyId,
              parentId: savedCategory.id,
              code: template.code,
              label: template.label,
              description: template.label,
              nodeType: NodeType.Setting,
              sortOrder: index,
              createdBy: userId,
              updatedBy: userId,
            });

            this.parseAndSetValue(child, String(numericValue), ValueType.Number);
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
        createChildren: async ({ dto, savedCategory, companyId, userId }) => {
          const findIncomingValue = (code: SessionPolicyCodeEnum) => {
            const incoming = (dto.subcategories || []).find(
              sub => normalizeCode(sub.code) === code,
            );
            return incoming?.value ?? '';
          };

          const proposedPolicy: SessionPolicyConfig = {
            allowMultipleLogin: this.sessionPolicyService.parsePolicyBoolean(
              findIncomingValue(SessionPolicyCodeEnum.AllowMultipleLogin),
              'Allow Multiple Login',
            ),
            idleTimeoutSeconds: this.sessionPolicyService.parsePolicyInteger(
              findIncomingValue(SessionPolicyCodeEnum.IdleTimeoutSeconds),
              'Idle Timeout Seconds',
              true,
              true,
            ),
          };

          this.sessionPolicyService.validatePolicyConfig(proposedPolicy);

          for (const [index, template] of SESSION_POLICY_CHILDREN.entries()) {
            const child = this.settingRepository.create({
              companyId,
              parentId: savedCategory.id,
              code: template.code,
              label: template.label,
              description: template.label,
              nodeType: NodeType.Setting,
              sortOrder: index,
              createdBy: userId,
              updatedBy: userId,
            });

            if (template.code === SessionPolicyCodeEnum.AllowMultipleLogin) {
              this.parseAndSetValue(
                child,
                proposedPolicy.allowMultipleLogin ? 'YES' : 'NO',
                ValueType.Boolean,
              );
            } else {
              this.parseAndSetValue(child, String(proposedPolicy.idleTimeoutSeconds), ValueType.Number);
            }

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
    const company = await this.passwordPolicyService.getCompany();
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const companyId = company.id;
    const categoryCode = normalizeCode(dto.code);
    const existing = await this.settingRepository.findOne({
      where: { companyId, code: categoryCode, nodeType: NodeType.Category },
    });

    if (existing) {
      throw new ConflictException(`Category with code ${categoryCode} already exists`);
    }

    const category = this.settingRepository.create({
      companyId,
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
          companyId,
          userId,
        });
      } else if (dto.subcategories?.length) {
        for (const sub of dto.subcategories) {
          const child = this.settingRepository.create({
            companyId,
            parentId: savedCategory.id,
            code: normalizeCode(sub.code),
            label: sub.title.trim(),
            description: sub.title.trim(),
            nodeType: NodeType.Setting,
            createdBy: userId,
            updatedBy: userId,
          });
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
