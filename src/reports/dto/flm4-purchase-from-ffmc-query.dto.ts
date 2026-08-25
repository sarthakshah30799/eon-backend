import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsUUID,
} from "class-validator";
import { CardSettlementReportFormat } from "./card-settlement-report-query.dto";
import { FLM_FFMC_PROFILE_TYPES } from "../flm-ffmc-profile.constants";

export const Flm4PurchaseFromFfmcView = {
  NORMAL: "normal",
  EXTENDED: "extended",
} as const;

export type Flm4PurchaseFromFfmcView =
  (typeof Flm4PurchaseFromFfmcView)[keyof typeof Flm4PurchaseFromFfmcView];

const parseArrayQuery = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const values = Array.isArray(value) ? value : String(value).split(",");
  return values.map((item) => String(item).trim()).filter(Boolean);
};

export class Flm4PurchaseFromFfmcQueryDto {
  @ApiPropertyOptional({ description: "Start date in YYYY-MM-DD format" })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: "End date in YYYY-MM-DD format" })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: "Filter by branch ids", isArray: true })
  @Transform(parseArrayQuery)
  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  branchIds?: string[];

  @ApiPropertyOptional({ description: "Product id. Defaults to CN when omitted." })
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({
    description:
      "Filter by profile types. Omit or leave empty to include all FLM-4 profiles.",
    isArray: true,
    enum: FLM_FFMC_PROFILE_TYPES,
  })
  @Transform(parseArrayQuery)
  @IsArray()
  @IsIn(FLM_FFMC_PROFILE_TYPES, { each: true })
  @IsOptional()
  profileTypes?: string[];

  @ApiPropertyOptional({
    description: "Report view",
    enum: Object.values(Flm4PurchaseFromFfmcView),
  })
  @IsIn(Object.values(Flm4PurchaseFromFfmcView))
  @IsOptional()
  view?: Flm4PurchaseFromFfmcView;

  @ApiPropertyOptional({
    description: "Export format",
    enum: CardSettlementReportFormat,
  })
  @IsEnum(CardSettlementReportFormat)
  @IsOptional()
  format?: CardSettlementReportFormat;
}
