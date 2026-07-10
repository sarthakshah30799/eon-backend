import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type, Transform } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

const parseBoolean = ({ value }: { value: unknown }) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
};

export class AccountProfileListQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ description: "Global search across account code and name" })
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
}
