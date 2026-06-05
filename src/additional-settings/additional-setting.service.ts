import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AdvancedSetting, NodeType, ValueType } from "./advanced-setting.entity";
import { Company } from "../company/company.entity";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { UpdateSubcategoryDto } from "./dto/update-subcategory.dto";

@Injectable()
export class AdditionalSettingService {
  constructor(
    @InjectRepository(AdvancedSetting)
    private readonly settingRepository: Repository<AdvancedSetting>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
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
    let company = await this.companyRepository.findOne({ where: {} });
    if (!company) {
      company = this.companyRepository.create({
        id: '11111111-1111-4111-b111-111111111111',
        name: 'Default Company',
        panNo: 'DEFAULT1234P',
        createdBy: userId,
        updatedBy: userId,
      });
      company = await this.companyRepository.save(company);
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

    if (dto.subcategories && dto.subcategories.length > 0) {
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

    setting.description = dto.description.trim();
    this.parseAndSetValue(setting, dto.value, setting.valueType);
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
