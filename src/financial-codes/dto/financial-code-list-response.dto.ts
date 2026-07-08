import { ApiProperty } from "@nestjs/swagger";
import { FinancialCodeResponseDto } from "./financial-code-response.dto";

export class FinancialCodeListResponseDto {
  @ApiProperty({ type: [FinancialCodeResponseDto] })
  data: FinancialCodeResponseDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalItems: number;

  @ApiProperty()
  totalPages: number;
}
