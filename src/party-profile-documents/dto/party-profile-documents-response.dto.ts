import { ApiProperty } from '@nestjs/swagger';
import { PartyProfileDocumentProfileResponseDto } from './party-profile-document-profile-response.dto';

export class PartyProfileDocumentsResponseDto {
  @ApiProperty()
  partyProfileId: string;

  @ApiProperty({ type: [PartyProfileDocumentProfileResponseDto] })
  documentProfiles: PartyProfileDocumentProfileResponseDto[];
}
