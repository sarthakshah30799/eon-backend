import { ApiProperty } from "@nestjs/swagger";
import { PartyProfile, ClientType } from "../party-profile.entity";

export class PartyProfileReferenceResponseDto {
  @ApiProperty({ description: "UUID of the referenced party profile" })
  id: string;

  @ApiProperty({ description: "Party profile code" })
  code: string;

  @ApiProperty({ description: "Party profile name" })
  name: string;

  @ApiProperty({ description: "Party profile type", enum: ClientType })
  type: ClientType;

  static fromEntity(
    entity: PartyProfile | null | undefined,
  ): PartyProfileReferenceResponseDto | null {
    if (!entity) {
      return null;
    }

    const dto = new PartyProfileReferenceResponseDto();
    dto.id = entity.id;
    dto.code = entity.code;
    dto.name = entity.name;
    dto.type = entity.type;
    return dto;
  }
}
