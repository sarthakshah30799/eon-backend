import { ApiProperty } from "@nestjs/swagger";
import { SelectOption } from "../category-option.entity";

export class SelectOptionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  value: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: SelectOption): SelectOptionResponseDto {
    const dto = new SelectOptionResponseDto();
    dto.id = entity.id;
    dto.code = String(entity.code ?? '').replace(/[_\s-]/g, '').toUpperCase();
    dto.value = entity.value;
    dto.label = entity.label;
    dto.sortOrder = entity.sortOrder;
    dto.isActive = entity.isActive;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
