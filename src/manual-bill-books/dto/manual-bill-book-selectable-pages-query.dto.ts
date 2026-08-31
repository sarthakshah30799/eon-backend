import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

export class ManualBillBookSelectablePagesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Assigned user UUID (defaults to current session user)",
  })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description: "Manual bill book transaction type filter (or ALL)",
  })
  @IsString()
  @IsOptional()
  transactionType?: string;
}
