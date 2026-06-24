import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentProfile, DocumentSpecificationType } from '../document-profile.entity';
import { SelectOptionResponseDto } from '../../category-options/dto/category-option-response.dto';

export class DocumentProfileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  documentCode: string;

  @ApiProperty()
  documentDescription: string;

  @ApiProperty({ type: [String] })
  documentType: string[];

  @ApiProperty()
  isRequired: boolean;

  @ApiProperty()
  maxSizeMb: number;

  @ApiProperty({ enum: DocumentSpecificationType })
  specificationType: DocumentSpecificationType;

  @ApiPropertyOptional({ type: SelectOptionResponseDto, nullable: true })
  type: SelectOptionResponseDto | null;

  @ApiPropertyOptional({ type: SelectOptionResponseDto, nullable: true })
  groupSelection: SelectOptionResponseDto | null;

  @ApiPropertyOptional({ type: SelectOptionResponseDto, nullable: true })
  entitySelection: SelectOptionResponseDto | null;

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: DocumentProfile): DocumentProfileResponseDto {
    const dto = new DocumentProfileResponseDto();
    dto.id = entity.id;
    dto.documentCode = entity.documentCode;
    dto.documentDescription = entity.documentDescription;
    dto.documentType = entity.documentType;
    dto.isRequired = entity.isRequired;
    dto.maxSizeMb = Number(entity.maxSizeMb);
    dto.specificationType = entity.specificationType;
    dto.type = entity.type ? SelectOptionResponseDto.fromEntity(entity.type) : null;
    dto.groupSelection = entity.groupSelection
      ? SelectOptionResponseDto.fromEntity(entity.groupSelection)
      : null;
    dto.entitySelection = entity.entitySelection
      ? SelectOptionResponseDto.fromEntity(entity.entitySelection)
      : null;
    dto.active = entity.active;
    dto.sortOrder = entity.sortOrder;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
