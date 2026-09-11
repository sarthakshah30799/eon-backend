import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsBoolean, IsEnum } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";
import { BooleanQuery } from "../../common/transformers/parse-boolean-query";
import { CurrencyProductAllowed } from "../currency.entity";

export class CurrencyListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      "Global search across currency code, currency name, and country name",
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description:
      "When false, include inactive currencies. Default true (active only).",
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  @BooleanQuery()
  activeOnly?: boolean;

  @ApiPropertyOptional({
    description:
      "When true, return both tradable and only-stocking currencies (no onlyStocking filter).",
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @BooleanQuery()
  includeAllStockingTypes?: boolean;

  @ApiPropertyOptional({
    description:
      "When true, include only-stocking currencies. Default false excludes them from sale/purchase lists.",
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @BooleanQuery()
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
