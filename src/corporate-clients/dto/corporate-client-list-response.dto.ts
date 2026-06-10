import { ApiProperty } from "@nestjs/swagger";
import { CorporateClientResponseDto } from "./corporate-client-response.dto";

export class CorporateClientListResponseDto {
  @ApiProperty({ type: [CorporateClientResponseDto] })
  data: CorporateClientResponseDto[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 25 })
  totalItems: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}
