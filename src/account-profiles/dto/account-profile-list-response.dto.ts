import { ApiProperty } from "@nestjs/swagger";
import { AccountProfileResponseDto } from "./account-profile-response.dto";

export class AccountProfileListResponseDto {
  @ApiProperty({ type: [AccountProfileResponseDto] })
  data: AccountProfileResponseDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalItems: number;

  @ApiProperty()
  totalPages: number;
}
