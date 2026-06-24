import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentProfile } from '../../document-profiles/document-profile.entity';
import { DocumentProfileResponseDto } from '../../document-profiles/dto/document-profile-response.dto';
import { SelectOptionResponseDto } from '../../category-options/dto/category-option-response.dto';
import { PartyProfileDocument } from '../party-profile-document.entity';
import { PartyProfileDocumentFileResponseDto } from './party-profile-document-file-response.dto';

export class PartyProfileDocumentProfileResponseDto {
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

  @ApiProperty()
  specificationType: string;

  @ApiProperty()
  type: SelectOptionResponseDto | null;

  @ApiPropertyOptional({ nullable: true })
  groupSelection: SelectOptionResponseDto | null;

  @ApiPropertyOptional({ nullable: true })
  entitySelection: SelectOptionResponseDto | null;

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  sortOrder: number;

  @ApiPropertyOptional({ nullable: true })
  partyProfileDocumentId: string | null;

  @ApiPropertyOptional({ nullable: true, type: PartyProfileDocumentFileResponseDto })
  documentFile: PartyProfileDocumentFileResponseDto | null;

  static fromEntity(
    entity: DocumentProfile,
    partyProfileDocuments: Map<string, PartyProfileDocument>,
  ): PartyProfileDocumentProfileResponseDto {
    const dto = new PartyProfileDocumentProfileResponseDto();
    const baseDto = DocumentProfileResponseDto.fromEntity(entity);
    dto.id = baseDto.id;
    dto.documentCode = baseDto.documentCode;
    dto.documentDescription = baseDto.documentDescription;
    dto.documentType = baseDto.documentType;
    dto.isRequired = baseDto.isRequired;
    dto.maxSizeMb = baseDto.maxSizeMb;
    dto.specificationType = baseDto.specificationType;
    dto.type = baseDto.type;
    dto.groupSelection = baseDto.groupSelection;
    dto.entitySelection = baseDto.entitySelection;
    dto.active = baseDto.active;
    dto.sortOrder = baseDto.sortOrder;
    const partyProfileDocument = partyProfileDocuments.get(entity.id);
    dto.partyProfileDocumentId = partyProfileDocument?.id ?? null;
    dto.documentFile = partyProfileDocument?.documentFile
      ? PartyProfileDocumentFileResponseDto.fromEntity(
          partyProfileDocument.documentFile,
        )
      : null;
    return dto;
  }
}
