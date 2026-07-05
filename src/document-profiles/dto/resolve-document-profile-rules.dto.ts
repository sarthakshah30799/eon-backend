import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { IsEnum, IsString } from 'class-validator';
import { DocumentSpecificationType } from '../document-profile.entity';

export class ResolveDocumentProfilesDto {
  @ApiPropertyOptional({ enum: DocumentSpecificationType })
  @IsEnum(DocumentSpecificationType)
  @IsOptional()
  specificationType?: DocumentSpecificationType;

  @ApiPropertyOptional({ description: 'Document type value or label' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: 'Document group selection value' })
  @IsUUID()
  @IsOptional()
  groupSelection?: string;

  @ApiPropertyOptional({ description: 'Entity selection value' })
  @IsUUID()
  @IsOptional()
  entitySelection?: string;
}
