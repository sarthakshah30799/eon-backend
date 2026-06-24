import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayNotEmpty,
  IsNumber,
  Min,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { CreateDocumentProfileRuleDto } from './create-document-profile-rule.dto';
import { DocumentSpecificationType } from '../document-profile.entity';

export class CreateDocumentProfileDto {
  @ApiProperty({
    description: 'Specification type',
    enum: DocumentSpecificationType,
  })
  @IsEnum(DocumentSpecificationType)
  @IsNotEmpty()
  specificationType: DocumentSpecificationType;

  @ApiProperty({
    description: 'Type',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  type: string;

  @ApiProperty({
    description: 'Group selection',
  })
  @IsUUID()
  @IsNotEmpty()
  groupSelection: string;

  @ApiProperty({
    description: 'Entity type selection',
  })
  @IsUUID()
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
