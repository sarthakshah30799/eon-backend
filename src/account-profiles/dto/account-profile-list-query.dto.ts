import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

const parseBoolean = ({ value }: { value: unknown }) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
};

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
  @Transform(parseBoolean)
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @ApiPropertyOptional({ description: "Filter by bulk purchase support" })
  @Transform(parseBoolean)
  @IsBoolean()
  @IsOptional()
  bulkPurchase?: boolean;

  @ApiPropertyOptional({ description: "Filter by bulk sale support" })
  @Transform(parseBoolean)
  @IsBoolean()
  @IsOptional()
  bulkSale?: boolean;

  @ApiPropertyOptional({ description: "Filter by receipt voucher support" })
  @Transform(parseBoolean)
  @IsBoolean()
  @IsOptional()
  receipt?: boolean;

  @ApiPropertyOptional({ description: "Filter by payment voucher support" })
  @Transform(parseBoolean)
  @IsBoolean()
  @IsOptional()
  payment?: boolean;

  @ApiPropertyOptional({ description: "Filter by journal voucher support" })
  @Transform(parseBoolean)
  @IsBoolean()
  @IsOptional()
  journalVoucher?: boolean;
}
