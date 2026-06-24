import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentProfile, DocumentSpecificationType } from '../document-profile.entity';

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

  @ApiProperty()
  type: string;

  @ApiPropertyOptional({ nullable: true })
  groupSelection: string | null;

  @ApiPropertyOptional({ nullable: true })
  entitySelection: string | null;

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
    dto.type = entity.type;
    dto.groupSelection = entity.groupSelection;
    dto.entitySelection = entity.entitySelection;
    dto.active = entity.active;
    dto.sortOrder = entity.sortOrder;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
