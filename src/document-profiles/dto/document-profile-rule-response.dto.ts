import { ApiProperty } from '@nestjs/swagger';
import { DocumentProfileRule } from '../document-profile-rule.entity';

export class DocumentProfileRuleResponseDto {
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

  @ApiProperty({ required: false, nullable: true })
  profileSelection: string | null;

  @ApiProperty({ required: false, nullable: true })
  entitySelection: string | null;

  @ApiProperty({ required: false, nullable: true })
  fieldSelection: string | null;

  @ApiProperty({ required: false, nullable: true })
  fieldValue: string | null;

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  sortOrder: number;

  static fromEntity(entity: DocumentProfileRule): DocumentProfileRuleResponseDto {
    const dto = new DocumentProfileRuleResponseDto();
    dto.id = entity.id;
    dto.documentCode = entity.documentCode;
    dto.documentDescription = entity.documentDescription;
    dto.documentType = entity.documentType;
    dto.isRequired = entity.isRequired;
    dto.maxSizeMb = Number(entity.maxSizeMb);
    dto.profileSelection = entity.profileSelection;
    dto.entitySelection = entity.entitySelection;
    dto.fieldSelection = entity.fieldSelection;
    dto.fieldValue = entity.fieldValue;
    dto.active = entity.active;
    dto.sortOrder = entity.sortOrder;
    return dto;
  }
}

