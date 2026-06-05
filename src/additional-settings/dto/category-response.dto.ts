import { ApiProperty } from "@nestjs/swagger";
import { AdvancedSetting } from "../advanced-setting.entity";
import { SubcategoryResponseDto } from "./subcategory-response.dto";

export class CategoryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  code: string;

  @ApiProperty({ type: [SubcategoryResponseDto] })
  subcategories: SubcategoryResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: AdvancedSetting): CategoryResponseDto {
    const dto = new CategoryResponseDto();
    dto.id = entity.id;
    dto.title = entity.label;
    dto.code = entity.code;
    dto.subcategories = (entity.children || []).map(sub => SubcategoryResponseDto.fromEntity(sub));
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
