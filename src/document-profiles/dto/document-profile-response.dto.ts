import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentProfile, DocumentSpecificationType } from '../document-profile.entity';
import { DocumentProfileRuleResponseDto } from './document-profile-rule-response.dto';

export class DocumentProfileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: DocumentSpecificationType })
  specificationType: DocumentSpecificationType;

  @ApiProperty()
  type: string;

  @ApiPropertyOptional({ nullable: true })
  groupSelection: string | null;

  @ApiPropertyOptional({ nullable: true })
  entitySelection: string | null;

  @ApiPropertyOptional({ nullable: true })
  profileDescription: string | null;

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty({ type: [DocumentProfileRuleResponseDto] })
  rules: DocumentProfileRuleResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: DocumentProfile): DocumentProfileResponseDto {
    const dto = new DocumentProfileResponseDto();
    dto.id = entity.id;
    dto.specificationType = entity.specificationType;
    dto.type = entity.type;
    dto.groupSelection = entity.groupSelection;
    dto.entitySelection = entity.entitySelection;
    dto.profileDescription = entity.profileDescription;
    dto.active = entity.active;
    dto.sortOrder = entity.sortOrder;
    dto.rules = (entity.rules ?? [])
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(rule => DocumentProfileRuleResponseDto.fromEntity(rule));
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
