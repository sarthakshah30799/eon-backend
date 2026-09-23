import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PurposeSubpurpose } from "../purpose-subpurpose.entity";

export class PurposeSubpurposeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  purposeId: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ required: false })
  createdBy?: string;

  @ApiPropertyOptional({ required: false })
  updatedBy?: string;

  static fromEntity(entity: PurposeSubpurpose): PurposeSubpurposeResponseDto {
    const dto = new PurposeSubpurposeResponseDto();
    dto.id = entity.id;
    dto.purposeId = entity.purposeId;
    dto.code = entity.code;
    dto.name = entity.name;
    dto.isActive = entity.isActive;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    dto.createdBy = entity.createdBy;
    dto.updatedBy = entity.updatedBy;
    return dto;
  }
}
