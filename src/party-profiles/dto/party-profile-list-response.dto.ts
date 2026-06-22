import { ApiProperty } from "@nestjs/swagger";
import { PartyProfileResponseDto } from "./party-profile-response.dto";

export class PartyProfileListResponseDto {
  @ApiProperty({ type: [PartyProfileResponseDto] })
  data: PartyProfileResponseDto[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 25 })
  totalItems: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}
