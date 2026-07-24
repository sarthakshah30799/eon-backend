import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Length, ValidateNested, Min } from 'class-validator';
import { PurposeRateType } from '../purpose.enums';
import { PurposeSlabDto } from './purpose-slab.dto';
import { TransactionType } from '../../transactions/transactions.enums';

export class CreatePurposeDto {
  @ApiProperty({ description: '2-character purpose code', example: 'B' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 2)
  code: string;

  @ApiProperty({ description: 'Purpose description', example: 'Private Visit' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ description: 'Threshold amount', example: 1000000, default: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  threshold?: number;

  @ApiPropertyOptional({ description: 'Base rate', example: 20, default: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  rate?: number;

  @ApiPropertyOptional({ enum: PurposeRateType, default: PurposeRateType.PERCENT })
  @IsEnum(PurposeRateType)
  @IsOptional()
  rateType?: PurposeRateType;

  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  transactionType: TransactionType;

  @ApiPropertyOptional({ type: [PurposeSlabDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurposeSlabDto)
  @IsOptional()
  slabs?: PurposeSlabDto[];
}
