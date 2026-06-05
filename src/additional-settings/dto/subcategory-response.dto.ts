import { ApiProperty } from "@nestjs/swagger";
import { AdvancedSetting, ValueType } from "../advanced-setting.entity";

export class SubcategoryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  categoryId: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  value: string;

  @ApiProperty({ enum: ValueType })
  categoryType: ValueType;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: AdvancedSetting): SubcategoryResponseDto {
    const dto = new SubcategoryResponseDto();
    dto.id = entity.id;
    dto.categoryId = entity.parentId || "";
    dto.title = entity.label;
    dto.description = entity.description || "";
    dto.code = entity.code;
    dto.categoryType = entity.valueType;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;

    switch (entity.valueType) {
      case ValueType.Boolean:
        dto.value = entity.valueBoolean ? "YES" : "NO";
        break;
      case ValueType.Number:
        dto.value = entity.valueNumber !== null && entity.valueNumber !== undefined ? String(entity.valueNumber) : "";
        break;
      case ValueType.Decimal:
        dto.value = entity.valueDecimal !== null && entity.valueDecimal !== undefined ? String(entity.valueDecimal) : "";
        break;
      case ValueType.Date:
        dto.value = entity.valueDate ? entity.valueDate.toISOString() : "";
        break;
      case ValueType.Json:
        dto.value = entity.valueJson ? JSON.stringify(entity.valueJson) : "";
        break;
      case ValueType.Text:
      default:
        dto.value = entity.valueText || "";
        break;
    }

    return dto;
  }
}
