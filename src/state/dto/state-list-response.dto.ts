import { ApiProperty } from "@nestjs/swagger";
import { StateResponseDto } from "./state-response.dto";

export class StateListResponseDto {
  @ApiProperty({ type: [StateResponseDto] })
  data: StateResponseDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalItems: number;

  @ApiProperty()
  totalPages: number;
}
