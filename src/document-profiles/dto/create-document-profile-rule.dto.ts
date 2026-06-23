import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
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

  @ApiProperty({ description: 'Document type', example: ['PDF'], type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(50, { each: true })
  documentType: string[];

  @ApiPropertyOptional({ description: 'Is the document required?', default: false })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @ApiProperty({ description: 'Maximum file size in MB', example: 5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  maxSizeMb: number;

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
