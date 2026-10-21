import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsUUID,
} from "class-validator";
import {
  BooleanQuery,
  StringArrayQuery,
} from "../../common/transformers/parse-boolean-query";
import { CardSettlementReportFormat } from "./card-settlement-report-query.dto";

export const OutstandingPartySelection = {
  MSME: "msme",
  OTHERS: "others",
  ALL: "all",
} as const;

export type OutstandingPartySelection =
  (typeof OutstandingPartySelection)[keyof typeof OutstandingPartySelection];

export const OutstandingTransactionSide = {
  PURCHASE: "purchase",
  SALE: "sale",
  BOTH: "both",
} as const;

export type OutstandingTransactionSide =
  (typeof OutstandingTransactionSide)[keyof typeof OutstandingTransactionSide];

export const OutstandingGrouping = {
  CODE: "code",
  AGENT: "agent",
} as const;

export type OutstandingGrouping =
  (typeof OutstandingGrouping)[keyof typeof OutstandingGrouping];

export const OutstandingReportLayout = {
  DETAIL: "detail",
  SUMMARY: "summary",
} as const;

export type OutstandingReportLayout =
  (typeof OutstandingReportLayout)[keyof typeof OutstandingReportLayout];

export class OutstandingTransactionReportQueryDto {
  @ApiProperty({ description: "Start date in YYYY-MM-DD format" })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: "End date in YYYY-MM-DD format" })
  @IsDateString()
  endDate: string;

  @ApiProperty({
    description:
      "Outstanding as-of date. Payments on or before this date clear the bill.",
  })
  @IsDateString()
  accountingDate: string;

  @ApiPropertyOptional({
    enum: Object.values(OutstandingPartySelection),
  })
  @IsIn(Object.values(OutstandingPartySelection))
  @IsOptional()
  partySelection?: OutstandingPartySelection;

  @ApiPropertyOptional({ description: "Entity type category option id" })
  @IsUUID()
  @IsOptional()
  entityTypeId?: string;

  @ApiPropertyOptional({ description: "Filter by branch ids", isArray: true })
  @StringArrayQuery()
  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  branchIds?: string[];

  @ApiPropertyOptional({ description: "Filter by party profile ids", isArray: true })
  @StringArrayQuery()
  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  partyProfileIds?: string[];

  @ApiPropertyOptional({
    enum: Object.values(OutstandingTransactionSide),
  })
  @IsIn(Object.values(OutstandingTransactionSide))
  @IsOptional()
  transactionSide?: OutstandingTransactionSide;

  @ApiPropertyOptional({
    description: "Reserved. Interest is not applied yet.",
  })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  includeInterest?: boolean;

  @ApiPropertyOptional({
    description: "Reserved. Insurance is not applied yet.",
  })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  includeInsurance?: boolean;

  @ApiPropertyOptional({
    enum: Object.values(OutstandingGrouping),
    description: "Code wise groups by party. Agent wise groups by agent.",
  })
  @IsIn(Object.values(OutstandingGrouping))
  @IsOptional()
  grouping?: OutstandingGrouping;

  @ApiPropertyOptional({
    enum: Object.values(OutstandingReportLayout),
  })
  @IsIn(Object.values(OutstandingReportLayout))
  @IsOptional()
  layout?: OutstandingReportLayout;

  @ApiPropertyOptional({
    description: "Export format",
    enum: CardSettlementReportFormat,
  })
  @IsEnum(CardSettlementReportFormat)
  @IsOptional()
  format?: CardSettlementReportFormat;
}
