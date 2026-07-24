import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PurposeSlab } from '../purpose-slab.entity';
import { PurposeRateType } from '../purpose.enums';

export class PurposeSlabResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  purposeId: string;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  fromAmount: number;

  @ApiPropertyOptional({ nullable: true })
  toAmount: number | null;

  @ApiProperty()
  rate: number;

  @ApiProperty({ enum: PurposeRateType })
  rateType: PurposeRateType;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: PurposeSlab): PurposeSlabResponseDto {
    const dto = new PurposeSlabResponseDto();
    dto.id = entity.id;
    dto.purposeId = entity.purposeId;
    dto.sortOrder = entity.sortOrder;
    dto.fromAmount = Number(entity.fromAmount);
    dto.toAmount = entity.toAmount === null ? null : Number(entity.toAmount);
    dto.rate = Number(entity.rate);
    dto.rateType = entity.rateType;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
