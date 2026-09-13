import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";
import { BooleanQuery } from "../../common/transformers/parse-boolean-query";

export class AccountProfileListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Global search across account code and name",
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: "Filter by account code" })
  @IsString()
  @IsOptional()
  accountCode?: string;

  @ApiPropertyOptional({ description: "Filter by account name" })
  @IsString()
  @IsOptional()
  accountName?: string;

  @ApiPropertyOptional({ description: "Filter by account type UUID or label" })
  @IsString()
  @IsOptional()
  accountType?: string;

  @ApiPropertyOptional({ description: "Filter by financial code ID (UUID)" })
  @IsUUID()
  @IsOptional()
  financialCodeId?: string;

  @ApiPropertyOptional({ description: "Filter by currency ID (UUID)" })
  @IsUUID()
  @IsOptional()
  currencyId?: string;

  @ApiPropertyOptional({ description: "Filter by active status" })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @ApiPropertyOptional({ description: "Filter by bulk purchase support" })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  bulkPurchase?: boolean;

  @ApiPropertyOptional({ description: "Filter by bulk sale support" })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  bulkSale?: boolean;

  @ApiPropertyOptional({ description: "Filter by receipt voucher support" })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  receipt?: boolean;

  @ApiPropertyOptional({ description: "Filter by payment voucher support" })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  payment?: boolean;

  @ApiPropertyOptional({ description: "Filter by journal voucher support" })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  journalVoucher?: boolean;
}
