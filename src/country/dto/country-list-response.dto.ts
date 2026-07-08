import { ApiProperty } from "@nestjs/swagger";
import { CountryResponseDto } from "./country-response.dto";

export class CountryListResponseDto {
  @ApiProperty({ type: [CountryResponseDto] })
  data: CountryResponseDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalItems: number;

  @ApiProperty()
  totalPages: number;
}
