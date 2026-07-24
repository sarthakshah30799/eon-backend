import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Purpose } from '../purpose.entity';
import { PurposeRateType } from '../purpose.enums';
import { PurposeSlabResponseDto } from './purpose-slab-response.dto';
import { TransactionType } from '../../transactions/transactions.enums';

export class PurposeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  threshold: number;

  @ApiProperty()
  rate: number;

  @ApiProperty({ enum: PurposeRateType })
  rateType: PurposeRateType;

  @ApiProperty({ enum: TransactionType })
  transactionType: TransactionType;

  @ApiProperty({ type: [PurposeSlabResponseDto] })
  slabs: PurposeSlabResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ required: false })
  createdBy?: string;

  @ApiPropertyOptional({ required: false })
  updatedBy?: string;

  static fromEntity(entity: Purpose): PurposeResponseDto {
    const dto = new PurposeResponseDto();
    dto.id = entity.id;
    dto.code = entity.code;
    dto.description = entity.description;
    dto.threshold = Number(entity.threshold);
    dto.rate = Number(entity.rate);
    dto.rateType = entity.rateType;
    dto.transactionType = entity.transactionType;
    dto.slabs = (entity.slabs ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(slab => PurposeSlabResponseDto.fromEntity(slab));
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    dto.createdBy = entity.createdBy;
    dto.updatedBy = entity.updatedBy;
    return dto;
  }
}
