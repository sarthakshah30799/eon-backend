import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsUUID,
} from "class-validator";
import { StringArrayQuery } from "../../common/transformers/parse-boolean-query";
import { CardSettlementReportFormat } from "./card-settlement-report-query.dto";

export const AfcReconciliationReportLayout = {
  DETAIL: "detail",
  SUMMARY: "summary",
} as const;

export type AfcReconciliationReportLayout =
  (typeof AfcReconciliationReportLayout)[keyof typeof AfcReconciliationReportLayout];

export const AfcReconciliationReportScope = {
  BRANCH: "branch",
  CONSOLIDATED: "consolidated",
} as const;

export type AfcReconciliationReportScope =
  (typeof AfcReconciliationReportScope)[keyof typeof AfcReconciliationReportScope];

export class AfcReconciliationReportQueryDto {
  @ApiProperty({ description: "Start date in YYYY-MM-DD format" })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: "End date in YYYY-MM-DD format" })
  @IsDateString()
  endDate!: string;

  @ApiProperty({
    description:
      "As-on date for bill applications and refunds. Receipts after this date are excluded.",
  })
  @IsDateString()
  accountingDate!: string;

  @ApiPropertyOptional({ description: "Filter by branch ids", isArray: true })
  @StringArrayQuery()
  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  branchIds?: string[];

  @ApiPropertyOptional({ description: "Filter by counter ids", isArray: true })
  @StringArrayQuery()
  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  counterIds?: string[];

  @ApiPropertyOptional({
    enum: Object.values(AfcReconciliationReportLayout),
  })
  @IsIn(Object.values(AfcReconciliationReportLayout))
  @IsOptional()
  layout?: AfcReconciliationReportLayout;

  @ApiPropertyOptional({
    enum: Object.values(AfcReconciliationReportScope),
  })
  @IsIn(Object.values(AfcReconciliationReportScope))
  @IsOptional()
  scope?: AfcReconciliationReportScope;

  @ApiPropertyOptional({
    description: "Export format",
    enum: CardSettlementReportFormat,
  })
  @IsEnum(CardSettlementReportFormat)
  @IsOptional()
  format?: CardSettlementReportFormat;
}
