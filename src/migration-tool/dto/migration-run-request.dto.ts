import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsIn,
  IsOptional,
  Max,
  Min,
  IsString,
  ArrayNotEmpty,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MigrationRunRequestDto {
  @ApiProperty({ enum: ['string', 'options'] })
  @IsIn(['string', 'options'])
  connectionMode: 'string' | 'options';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  connectionString?: string;

  @ApiProperty({ required: false })
  @ValidateIf(dto => dto.connectionMode === 'options')
  @IsString()
  host?: string;

  @ApiProperty({ required: false })
  @ValidateIf(dto => dto.connectionMode === 'options')
  @IsInt()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  port?: number;

  @ApiProperty({ required: false })
  @ValidateIf(dto => dto.connectionMode === 'options')
  @IsString()
  username?: string;

  @ApiProperty({ required: false })
  @ValidateIf(dto => dto.connectionMode === 'options')
  @IsString()
  password?: string;

  @ApiProperty({ required: false })
  @ValidateIf(dto => dto.connectionMode === 'options')
  @IsString()
  database?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  ssl?: boolean;

  @ApiProperty({ type: [String], required: false, default: [] })
  @IsOptional()
  @ValidateIf(dto => dto.selectedTables !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  selectedTables?: string[];
}
