import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayNotEmpty,
  IsNumber,
  Min,
} from 'class-validator';
import { CreateDocumentProfileRuleDto } from './create-document-profile-rule.dto';
import { CategoryOptionCodeEnum } from '../../category-options/category-option-code.enum';

const DOCUMENT_PROFILE_TYPE_OPTIONS = [
  CategoryOptionCodeEnum.MasterDocument,
  CategoryOptionCodeEnum.TransactionDocument,
] as const;

export class CreateDocumentProfileDto {
  @ApiProperty({
    description: 'Specification type',
    enum: DOCUMENT_PROFILE_TYPE_OPTIONS,
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(DOCUMENT_PROFILE_TYPE_OPTIONS)
  specificationType: string;

  @ApiProperty({
    description: 'Type',
    enum: DOCUMENT_PROFILE_TYPE_OPTIONS,
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(DOCUMENT_PROFILE_TYPE_OPTIONS)
  type: string;

  @ApiProperty({
    description: 'Group selection',
  })
  @IsString()
  @IsNotEmpty()
  groupSelection: string;

  @ApiProperty({
    description: 'Entity type selection',
  })
  @IsString()
  @IsNotEmpty()
  entitySelection: string;

  @ApiPropertyOptional({ description: 'Profile active flag', default: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Profile sort order', default: 0 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({
    description: 'Document rules attached to this profile',
    type: [CreateDocumentProfileRuleDto],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateDocumentProfileRuleDto)
  rules: CreateDocumentProfileRuleDto[];
}
