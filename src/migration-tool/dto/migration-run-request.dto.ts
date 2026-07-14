import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsPort,
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
  @IsPort()
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

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  selectedTables: string[];
}

