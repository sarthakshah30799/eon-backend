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
import { FlmReportLayout } from "../flm-report-layout.constants";

export const Flm3PurchaseFromPublicView = {
  NORMAL: "normal",
  EXTENDED: "extended",
} as const;

export type Flm3PurchaseFromPublicView =
  (typeof Flm3PurchaseFromPublicView)[keyof typeof Flm3PurchaseFromPublicView];

const parseArrayQuery = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const values = Array.isArray(value) ? value : String(value).split(",");
  return values.map((item) => String(item).trim()).filter(Boolean);
};

export class Flm3PurchaseFromPublicQueryDto {
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

  @ApiPropertyOptional({
    description: "Product id. Defaults to CN when omitted.",
  })
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({
    description: "Report view",
    enum: Object.values(Flm3PurchaseFromPublicView),
  })
  @IsIn(Object.values(Flm3PurchaseFromPublicView))
  @IsOptional()
  view?: Flm3PurchaseFromPublicView;

  @ApiPropertyOptional({
    description:
      "Report layout. branch_wise shows one section per branch. consolidate rolls selected branches into one register.",
    enum: Object.values(FlmReportLayout),
  })
  @IsIn(Object.values(FlmReportLayout))
  @IsOptional()
  layout?: FlmReportLayout;

  @ApiPropertyOptional({
    description: "Export format",
    enum: CardSettlementReportFormat,
  })
  @IsEnum(CardSettlementReportFormat)
  @IsOptional()
  format?: CardSettlementReportFormat;
}
