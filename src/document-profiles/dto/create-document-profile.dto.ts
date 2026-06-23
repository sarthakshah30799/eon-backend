import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  ArrayNotEmpty,
  IsNumber,
  Min,
} from 'class-validator';
import { CreateDocumentProfileRuleDto } from './create-document-profile-rule.dto';

export class CreateDocumentProfileDto {
  @ApiProperty({ description: 'Document profile code', example: 'KYC_MASTER' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  profileCode: string;

  @ApiProperty({ description: 'Document profile name', example: 'KYC Documents' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  profileName: string;

  @ApiPropertyOptional({ description: 'Document profile description' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  profileDescription?: string | null;

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

