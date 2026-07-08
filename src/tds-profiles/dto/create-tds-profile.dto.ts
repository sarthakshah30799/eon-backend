import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  IsNotEmpty,
} from 'class-validator';

export class CreateTdsProfileDto {
  @ApiProperty({ description: 'Unique TDS profile code', example: 'TDS-01' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty({ description: 'TDS profile name', example: 'Standard TDS' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ description: 'TDS profile description' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({ description: 'Profile active flag', default: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Profile sort order', default: 0 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Valid from date', example: '2026-01-01' })
  @IsDateString()
  @IsOptional()
  from?: string | null;

  @ApiPropertyOptional({ description: 'Valid to date', example: '2026-12-31' })
  @IsDateString()
  @IsOptional()
  to?: string | null;

  @ApiProperty({ description: 'TDS percentage value', example: 10.0 })
  @Type(() => Number)
  @IsNumber()
  value: number;
}
