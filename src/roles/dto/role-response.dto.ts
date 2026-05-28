import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../role.entity';

export class RoleResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() code: string;
  @ApiProperty({ required: false }) description: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(entity: Role): RoleResponseDto {
    const dto = new RoleResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.code = entity.code;
    dto.description = entity.description;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
