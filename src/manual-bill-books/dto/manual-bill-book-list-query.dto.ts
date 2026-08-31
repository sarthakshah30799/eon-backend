import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { PaginationQueryDto } from "../../common/pagination/dto/pagination-query.dto";

/**
 * Query DTO for GET /manual-bill-books/dispatches.
 * Extends reusable PaginationQueryDto so every list endpoint shares
 * the same limit/offset contract. FE sends pagination via URL query params
 * exactly like filter & search: e.g. ?limit=10&offset=0&status=PENDING&search=MB26
 */
export class ManualBillBookListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      "Filter by branch ID (admin/HO only; ignored for branch users)",
  })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({
    description: "Filter by workflow status (PENDING / APPROVE / REJECT)",
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description:
      "Filter by transaction type (PURCHASE / SALE / specific profile)",
  })
  @IsString()
  @IsOptional()
  transactionType?: string;

  @ApiPropertyOptional({
    description: "Global search across dispatch no, remarks, book/MV numbers",
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: "Inclusive dispatch date from (YYYY-MM-DD)",
  })
  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @ApiPropertyOptional({
    description: "Inclusive dispatch date to (YYYY-MM-DD)",
  })
  @IsDateString()
  @IsOptional()
  toDate?: string;

  @ApiPropertyOptional({
    description: "Book-number range start (overlap filter; requires bookNoTo)",
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  bookNoFrom?: number;

  @ApiPropertyOptional({
    description: "Book-number range end (overlap filter; requires bookNoFrom)",
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  bookNoTo?: number;
}
