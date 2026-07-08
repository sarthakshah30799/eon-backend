import { ApiProperty } from "@nestjs/swagger";
import { FinancialSubProfileResponseDto } from "./financial-sub-profile-response.dto";

export class FinancialSubProfileListResponseDto {
  @ApiProperty({ type: [FinancialSubProfileResponseDto] })
  data: FinancialSubProfileResponseDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalItems: number;

  @ApiProperty()
  totalPages: number;
}
