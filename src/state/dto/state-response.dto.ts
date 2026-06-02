import { ApiProperty } from "@nestjs/swagger";
import { State } from "../state.entity";

export class StateResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  countryId: string;

  @ApiProperty()
  countryCode: string;

  @ApiProperty()
  countryName: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  gstStateCode: string;

  @ApiProperty({ required: false })
  ctrStateCode: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: State): StateResponseDto {
    const dto = new StateResponseDto();
    dto.id = entity.id;
    dto.countryId = entity.country?.id || null;
    dto.countryCode = entity.country?.code || null;
    dto.countryName = entity.country?.name || null;
    dto.code = entity.code;
    dto.name = entity.name;
    dto.gstStateCode = entity.gstStateCode;
    dto.ctrStateCode = entity.ctrStateCode;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
