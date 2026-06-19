import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AdvancedSetting, NodeType, ValueType } from "./advanced-setting.entity";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { UpdateSubcategoryDto } from "./dto/update-subcategory.dto";
import { PasswordPolicyService } from "../password-policy/password-policy.service";
import { PasswordPolicyCodeEnum } from "../password-policy/password-policy.enum";
import { PASSWORD_POLICY_CHILDREN, PasswordPolicyConfig } from "../password-policy/password-policy.dto";

@Injectable()
export class AdditionalSettingService {
  constructor(
    @InjectRepository(AdvancedSetting)
    private readonly settingRepository: Repository<AdvancedSetting>,
    private readonly passwordPolicyService: PasswordPolicyService,
  ) {}

  private getPasswordPolicyConfigKey(code: PasswordPolicyCodeEnum): keyof PasswordPolicyConfig | null {
    switch (code) {
      case PasswordPolicyCodeEnum.MinLength:
        return 'minLength';
      case PasswordPolicyCodeEnum.MaxLength:
        return 'maxLength';
      case PasswordPolicyCodeEnum.MinSpecialCharCount:
        return 'minSpecialCharCount';
      case PasswordPolicyCodeEnum.MinNumericCount:
        return 'minNumericCount';
      case PasswordPolicyCodeEnum.MinAlphaCount:
        return 'minAlphaCount';
      case PasswordPolicyCodeEnum.MaxInvalidAttempts:
        return 'maxInvalidAttempts';
      default:
        return null;
    }
  }

  private parseAndSetValue(setting: AdvancedSetting, value: string, valueType: ValueType) {
    setting.valueType = valueType;
    setting.valueBoolean = null;
    setting.valueText = null;
    setting.valueNumber = null;
    setting.valueDecimal = null;
    setting.valueDate = null;
    setting.valueJson = null;

    const cleanVal = value.trim();
    switch (valueType) {
      case ValueType.Boolean:
        setting.valueBoolean = cleanVal.toUpperCase() === "YES" || cleanVal.toLowerCase() === "true";
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

  async findAll(): Promise<AdvancedSetting[]> {
    return this.settingRepository.find({
      where: { nodeType: NodeType.Category },
      relations: ["children"],
      order: {
        sortOrder: "ASC",
        label: "ASC",
        children: {
          sortOrder: "ASC",
          label: "ASC",
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

    const existing = await this.settingRepository.findOne({
      where: { companyId, code: dto.code.trim(), nodeType: NodeType.Category },
    });
    if (existing) {
      throw new ConflictException(`Category with code ${dto.code} already exists`);
    }

    const category = this.settingRepository.create({
      companyId,
      code: dto.code.trim().toUpperCase(),
      label: dto.title.trim(),
      nodeType: NodeType.Category,
      createdBy: userId,
      updatedBy: userId,
    });

    const savedCategory = await this.settingRepository.save(category);

    if (savedCategory.code?.trim().toUpperCase() === PasswordPolicyCodeEnum.Policy) {
      try {
        const policyChildren = PASSWORD_POLICY_CHILDREN;
        const allowedCodes = new Set<string>(policyChildren.map(template => template.code));
        const proposedPolicy: Partial<PasswordPolicyConfig> = {};

        for (const [index, sub] of (dto.subcategories || []).entries()) {
          const code = sub.code?.trim().toUpperCase();
          if (!code || !allowedCodes.has(code)) {
            throw new BadRequestException(`Invalid password policy setting code: ${sub.code}`);
          }

          const configKey = this.getPasswordPolicyConfigKey(code as PasswordPolicyCodeEnum);
          const template = policyChildren.find(item => item.code === code);
          const numericValue = this.passwordPolicyService.parsePolicyInteger(
            sub.value,
            template?.label || sub.title,
            code === PasswordPolicyCodeEnum.MinLength || code === PasswordPolicyCodeEnum.MaxLength
              ? false
              : true,
          );

          if (configKey) {
            proposedPolicy[configKey] = numericValue;
          }

          const child = this.settingRepository.create({
            companyId,
            parentId: savedCategory.id,
            code,
            label: template?.label || sub.title,
            description: template?.label || sub.title,
            nodeType: NodeType.Setting,
            sortOrder: index,
            createdBy: userId,
            updatedBy: userId,
          });
          this.parseAndSetValue(child, String(numericValue), ValueType.Number);
          await this.settingRepository.save(child);
        }

        this.passwordPolicyService.validatePolicyConfig(proposedPolicy);
      } catch (error) {
        await this.settingRepository.delete({ id: savedCategory.id });
        throw error;
      }
    } else if (dto.subcategories && dto.subcategories.length > 0) {
      for (const sub of dto.subcategories) {
        const child = this.settingRepository.create({
          companyId,
          parentId: savedCategory.id,
          code: sub.code.trim().toUpperCase(),
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

    return this.settingRepository.findOne({
      where: { id: savedCategory.id },
      relations: ["children"],
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, userId: string): Promise<AdvancedSetting> {
    const category = await this.settingRepository.findOne({ where: { id, nodeType: NodeType.Category } });
    if (!category) {
      throw new NotFoundException(`Category not found`);
    }

    category.label = dto.title.trim();
    category.updatedBy = userId;
    await this.settingRepository.save(category);

    return this.settingRepository.findOne({
      where: { id },
      relations: ["children"],
    });
  }

  async updateSubcategory(
    categoryId: string,
    subcategoryId: string,
    dto: UpdateSubcategoryDto,
    userId: string
  ): Promise<AdvancedSetting> {
    const setting = await this.settingRepository.findOne({
      where: { id: subcategoryId, parentId: categoryId, nodeType: NodeType.Setting },
    });
    if (!setting) {
      throw new NotFoundException(`Setting not found under the specified category`);
    }

    const isPasswordPolicy = (await this.settingRepository.findOne({
      where: { id: categoryId, nodeType: NodeType.Category },
    }))?.code?.trim().toUpperCase() === PasswordPolicyCodeEnum.Policy;

    if (isPasswordPolicy) {
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
      this.parseAndSetValue(setting, String(numericValue), ValueType.Number);
    } else {
      setting.description = dto.description.trim();
      this.parseAndSetValue(setting, dto.value, setting.valueType);
    }
    setting.updatedBy = userId;
    await this.settingRepository.save(setting);

    const category = await this.settingRepository.findOne({
      where: { id: categoryId },
      relations: ["children"],
    });
    if (!category) {
      throw new NotFoundException(`Category not found`);
    }
    return category;
  }
}
