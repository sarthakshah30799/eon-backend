import { ApiProperty } from '@nestjs/swagger';
import { PartyProfileDocumentFile } from '../party-profile-document-file.entity';

export class PartyProfileDocumentFileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  sizeBytes: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(
    entity: PartyProfileDocumentFile,
  ): PartyProfileDocumentFileResponseDto {
    const dto = new PartyProfileDocumentFileResponseDto();
    dto.id = entity.id;
    dto.fileName = entity.fileName;
    dto.mimeType = entity.mimeType;
    dto.sizeBytes = entity.sizeBytes;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
