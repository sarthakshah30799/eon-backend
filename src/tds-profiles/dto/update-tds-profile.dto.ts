import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateTdsProfileDto {
  @ApiPropertyOptional({ description: 'Unique TDS profile code' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ description: 'TDS profile name' })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ description: 'TDS profile description' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({ description: 'Profile active flag' })
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Profile sort order' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Valid from date' })
  @IsDateString()
  @IsOptional()
  from?: string | null;

  @ApiPropertyOptional({ description: 'Valid to date' })
  @IsDateString()
  @IsOptional()
  to?: string | null;

  @ApiPropertyOptional({ description: 'TDS percentage value' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  value?: number;
}
