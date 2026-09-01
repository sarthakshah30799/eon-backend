import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsBoolean, IsEnum } from "class-validator";
import { Transform } from "class-transformer";
import { PaginationQueryDto } from "../../common/pagination";
import { CurrencyProductAllowed } from "../currency.entity";

const parseBooleanQuery = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return undefined;
};

export class CurrencyListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      "Global search across currency code, currency name, and country name",
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: "Filter by active status",
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(parseBooleanQuery)
  activeOnly?: boolean;

  @ApiPropertyOptional({
    description:
      "When true, return both tradable and only-stocking currencies (no onlyStocking filter).",
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(parseBooleanQuery)
  includeAllStockingTypes?: boolean;

  @ApiPropertyOptional({
    description:
      "When true, include only-stocking currencies. Default false excludes them from sale/purchase lists.",
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(parseBooleanQuery)
  includeOnlyStocking?: boolean;

  @ApiPropertyOptional({
    description:
      "When includeOnlyStocking is true, optionally restrict only-stocking rows to this productAllowed code (e.g. CM).",
    enum: CurrencyProductAllowed,
  })
  @IsEnum(CurrencyProductAllowed)
  @IsOptional()
  productAllowed?: CurrencyProductAllowed;
}
