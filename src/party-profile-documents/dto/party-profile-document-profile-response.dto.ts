import { ApiProperty } from '@nestjs/swagger';
import { DocumentProfile } from '../../document-profiles/document-profile.entity';
import { DocumentProfileResponseDto } from '../../document-profiles/dto/document-profile-response.dto';
import { PartyProfileDocument } from '../party-profile-document.entity';
import { PartyProfileDocumentRuleResponseDto } from './party-profile-document-rule-response.dto';

export class PartyProfileDocumentProfileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  specificationType: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  groupSelection: string | null;

  @ApiProperty()
  entitySelection: string | null;

  @ApiProperty({ required: false, nullable: true })
  profileDescription: string | null;

  @ApiProperty({ type: [PartyProfileDocumentRuleResponseDto] })
  rules: PartyProfileDocumentRuleResponseDto[];

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  sortOrder: number;

  static fromEntity(
    entity: DocumentProfile,
    partyProfileDocuments: Map<string, PartyProfileDocument>,
  ): PartyProfileDocumentProfileResponseDto {
    const dto = new PartyProfileDocumentProfileResponseDto();
    const baseDto = DocumentProfileResponseDto.fromEntity(entity);
    dto.id = baseDto.id;
    dto.specificationType = baseDto.specificationType;
    dto.type = baseDto.type;
    dto.groupSelection = baseDto.groupSelection;
    dto.entitySelection = baseDto.entitySelection;
    dto.profileDescription = baseDto.profileDescription;
    dto.active = baseDto.active;
    dto.sortOrder = baseDto.sortOrder;
    dto.rules = (entity.rules ?? [])
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(rule =>
        PartyProfileDocumentRuleResponseDto.fromEntity(
          rule,
          partyProfileDocuments.get(rule.id),
        ),
      );
    return dto;
  }
}
