import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

export class ChequeBookListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Filter by branch ID (admin/HO only; ignored for branch users)",
  })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ description: "Filter by workflow status" })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: "Filter by bank account code UUID" })
  @IsString()
  @IsOptional()
  bankAccountCode?: string;
}
