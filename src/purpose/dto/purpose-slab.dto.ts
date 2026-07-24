import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { PurposeRateType } from '../purpose.enums';

export class PurposeSlabDto {
  @ApiProperty({ description: 'Slab display order', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sortOrder: number;

  @ApiProperty({ description: 'Slab from amount', example: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fromAmount: number;

  @ApiPropertyOptional({ description: 'Slab to amount', example: 1000000, nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  toAmount?: number | null;

  @ApiProperty({ description: 'Slab rate', example: 5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rate: number;

  @ApiProperty({ enum: PurposeRateType, example: PurposeRateType.PERCENT })
  @IsEnum(PurposeRateType)
  rateType: PurposeRateType;
}
