import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";
import { TransactionStatus, TransactionType } from "../transactions.enums";

export class TransactionListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Filter by transaction slug" })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({
    description: "Filter by branch ID (admin/HO only; ignored for branch users)",
  })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ description: "Search transaction number" })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: Object.values(TransactionStatus) })
  @IsIn(Object.values(TransactionStatus))
  @IsOptional()
  status?: TransactionStatus;

  @ApiPropertyOptional({ description: "Filter by party profile ID" })
  @IsUUID()
  @IsOptional()
  partyProfileId?: string;

  @ApiPropertyOptional({ enum: Object.values(TransactionType) })
  @IsIn(Object.values(TransactionType))
  @IsOptional()
  transactionType?: TransactionType;
}
