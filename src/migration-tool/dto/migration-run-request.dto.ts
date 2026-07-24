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
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MigrationConnectionConfigDto {
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
}

export class MigrationRunRequestDto {
  @ApiProperty({ enum: ['currentMaster', 'currentTransaction'], required: false })
  @IsOptional()
  @IsIn(['currentMaster', 'currentTransaction'])
  schemaTarget?: 'currentMaster' | 'currentTransaction';

  @ApiProperty({ type: () => MigrationConnectionConfigDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => MigrationConnectionConfigDto)
  currentMasterConnection?: MigrationConnectionConfigDto;

  @ApiProperty({ type: () => MigrationConnectionConfigDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => MigrationConnectionConfigDto)
  currentTransactionConnection?: MigrationConnectionConfigDto;

  @ApiProperty({ type: () => MigrationConnectionConfigDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => MigrationConnectionConfigDto)
  oldMasterConnection?: MigrationConnectionConfigDto;

  @ApiProperty({ type: () => MigrationConnectionConfigDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => MigrationConnectionConfigDto)
  oldTransactionConnection?: MigrationConnectionConfigDto;

  @ApiProperty({ type: [String], required: false, default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedTables?: string[];
}
