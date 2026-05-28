import { ApiProperty } from '@nestjs/swagger';
import { Menu } from '../menu.entity';

export class MenuResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ required: false }) path: string;
  @ApiProperty({ required: false }) icon: string;
  @ApiProperty({ required: false }) parentId: string;
  @ApiProperty() sortOrder: number;
  @ApiProperty() isActive: boolean;
  @ApiProperty({ type: () => [MenuResponseDto], required: false })
  children?: MenuResponseDto[];

  static fromEntity(entity: Menu, includeChildren = false): MenuResponseDto {
    const dto = new MenuResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.path = entity.path;
    dto.icon = entity.icon;
    dto.parentId = entity.parent?.id || null;
    dto.sortOrder = entity.sortOrder;
    dto.isActive = entity.isActive;
    if (includeChildren && entity.children) {
      dto.children = entity.children
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(child => MenuResponseDto.fromEntity(child, true));
    }
    return dto;
  }
}
