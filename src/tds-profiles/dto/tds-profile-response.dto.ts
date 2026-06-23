import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TdsProfile } from '../tds-profile.entity';

export class TdsProfileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  sortOrder: number;

  @ApiPropertyOptional({ nullable: true })
  from: Date | null;

  @ApiPropertyOptional({ nullable: true })
  to: Date | null;

  @ApiProperty()
  value: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  createdBy?: string;

  @ApiProperty({ required: false })
  updatedBy?: string;

  static fromEntity(entity: TdsProfile): TdsProfileResponseDto {
    const dto = new TdsProfileResponseDto();
    dto.id = entity.id;
    dto.code = entity.code;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.active = entity.active;
    dto.sortOrder = entity.sortOrder;
    dto.from = entity.from;
    dto.to = entity.to;
    dto.value = Number(entity.value);
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    dto.createdBy = entity.createdBy;
    dto.updatedBy = entity.updatedBy;
    return dto;
  }
}
