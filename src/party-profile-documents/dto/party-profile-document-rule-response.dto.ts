import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentProfileRule } from '../../document-profiles/document-profile-rule.entity';
import { DocumentProfileRuleResponseDto } from '../../document-profiles/dto/document-profile-rule-response.dto';
import { PartyProfileDocument } from '../party-profile-document.entity';
import { PartyProfileDocumentFileResponseDto } from './party-profile-document-file-response.dto';

export class PartyProfileDocumentRuleResponseDto {
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
  active: boolean;

  @ApiProperty()
  sortOrder: number;

  @ApiPropertyOptional({ nullable: true })
  partyProfileDocumentId: string | null;

  @ApiPropertyOptional({ nullable: true, type: PartyProfileDocumentFileResponseDto })
  documentFile: PartyProfileDocumentFileResponseDto | null;

  static fromEntity(
    entity: DocumentProfileRule,
    partyProfileDocument?: PartyProfileDocument | null,
  ): PartyProfileDocumentRuleResponseDto {
    const dto = Object.assign(
      new PartyProfileDocumentRuleResponseDto(),
      DocumentProfileRuleResponseDto.fromEntity(entity),
    );
    dto.partyProfileDocumentId = partyProfileDocument?.id ?? null;
    dto.documentFile = partyProfileDocument?.documentFile
      ? PartyProfileDocumentFileResponseDto.fromEntity(
          partyProfileDocument.documentFile,
        )
      : null;
    return dto;
  }
}
