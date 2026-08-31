import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

export class ChequeBookSelectablePagesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Bank account profile UUID" })
  @IsString()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional({
    description: "Assigned user UUID (defaults to current session user)",
  })
  @IsString()
  @IsOptional()
  userId?: string;
}
