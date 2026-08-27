import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination/dto/pagination-query.dto";

/**
 * Query DTO for GET /manual-bill-books/dispatches.
 * Extends reusable PaginationQueryDto so every list endpoint shares
 * the same limit/offset contract. FE sends pagination via URL query params
 * exactly like filter & search: e.g. ?limit=10&offset=0&status=PENDING&search=MB26
 */
export class ManualBillBookListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Filter by branch ID (admin/HO only; ignored for branch users)" })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ description: "Filter by workflow status (PENDING / APPROVE / REJECT)" })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: "Filter by transaction type (PURCHASE / SALE / specific profile)" })
  @IsString()
  @IsOptional()
  transactionType?: string;

  @ApiPropertyOptional({ description: "Global search across dispatch no, transaction type, remarks" })
  @IsString()
  @IsOptional()
  search?: string;
}
