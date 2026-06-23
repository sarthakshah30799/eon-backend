import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDocumentProfileRuleDto {
  @ApiProperty({ description: 'Unique document code', example: 'PAN_CARD' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  documentCode: string;

  @ApiProperty({ description: 'Document description', example: 'PAN card copy' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  documentDescription: string;

  @ApiProperty({ description: 'Document type', example: 'PDF' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  documentType: string;

  @ApiPropertyOptional({ description: 'Is the document required?', default: false })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @ApiProperty({ description: 'Maximum file size in MB', example: 5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  maxSizeMb: number;

  @ApiPropertyOptional({ description: 'Target profile selection', example: 'MASTER' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  profileSelection?: string | null;

  @ApiPropertyOptional({ description: 'Target entity selection', example: 'COMPANY' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  entitySelection?: string | null;

  @ApiPropertyOptional({ description: 'Field selection key', example: 'ENTITY_TYPE' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  fieldSelection?: string | null;

  @ApiPropertyOptional({ description: 'Field selection value', example: 'OTHER' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  fieldValue?: string | null;

  @ApiPropertyOptional({ description: 'Active flag', default: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Sort order', default: 0 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  sortOrder?: number;
}

