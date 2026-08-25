import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PurposeGroup } from '../purpose-group.entity';
import { PurposeGroupProfileType } from '../purpose.enums';
import { PurposeResponseDto } from './purpose-response.dto';

export class PurposeGroupResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: PurposeGroupProfileType })
  profileType: PurposeGroupProfileType;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty({ type: [PurposeResponseDto] })
  purposes: PurposeResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ required: false })
  createdBy?: string;

  @ApiPropertyOptional({ required: false })
  updatedBy?: string;

  static fromEntity(entity: PurposeGroup): PurposeGroupResponseDto {
    const dto = new PurposeGroupResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.title = entity.title;
    dto.profileType = entity.profileType;
    dto.sortOrder = entity.sortOrder;
    dto.purposes = (entity.purposes ?? [])
      .map(link => link.purpose)
      .filter((purpose): purpose is NonNullable<typeof purpose> => Boolean(purpose))
      .map(purpose => PurposeResponseDto.fromEntity(purpose));
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    dto.createdBy = entity.createdBy;
    dto.updatedBy = entity.updatedBy;
    return dto;
  }
}
