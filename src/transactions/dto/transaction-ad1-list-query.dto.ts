import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

export class TransactionAd1ListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Filter by branch ID (admin/HO only; ignored for branch users)",
  })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ description: "Search AD1 document number" })
  @IsString()
  @IsOptional()
  search?: string;
}
