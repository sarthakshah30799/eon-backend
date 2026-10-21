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
import {
  OutstandingPartySelection,
  OutstandingTransactionSide,
} from "./outstanding-transaction-report-query.dto";

export const AgeingReportLayout = {
  DETAIL: "detail",
  SUMMARY: "summary",
} as const;

export type AgeingReportLayout =
  (typeof AgeingReportLayout)[keyof typeof AgeingReportLayout];

export const AgeingEefcFilter = {
  EEFC: "eefc",
  NON_EEFC: "non_eefc",
  ALL: "all",
} as const;

export type AgeingEefcFilter =
  (typeof AgeingEefcFilter)[keyof typeof AgeingEefcFilter];

export const AgeingScope = {
  BRANCH: "branch",
  CONSOLIDATED: "consolidated",
} as const;

export type AgeingScope = (typeof AgeingScope)[keyof typeof AgeingScope];

export const AgeingBucket = {
  D1_10: "d1_10",
  D11_20: "d11_20",
  D21_30: "d21_30",
  D31_45: "d31_45",
  D46_90: "d46_90",
  D91_180: "d91_180",
  D181_365: "d181_365",
  ABOVE_365: "above365",
} as const;

export type AgeingBucket = (typeof AgeingBucket)[keyof typeof AgeingBucket];

export class AgeingReportQueryDto {
  @ApiProperty({ description: "Start date in YYYY-MM-DD format" })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description:
      "End date in YYYY-MM-DD format. This date is also the ageing as-on date.",
  })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ enum: Object.values(OutstandingPartySelection) })
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
    description: "Filter by party-control account ids",
    isArray: true,
  })
  @StringArrayQuery()
  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  accountIds?: string[];

  @ApiPropertyOptional({
    description: "Ageing buckets to include. Empty includes every bucket.",
    enum: Object.values(AgeingBucket),
    isArray: true,
  })
  @StringArrayQuery()
  @IsArray()
  @IsIn(Object.values(AgeingBucket), { each: true })
  @IsOptional()
  ageingBuckets?: AgeingBucket[];

  @ApiPropertyOptional({ enum: Object.values(OutstandingTransactionSide) })
  @IsIn(Object.values(OutstandingTransactionSide))
  @IsOptional()
  transactionSide?: OutstandingTransactionSide;

  @ApiPropertyOptional({ enum: Object.values(AgeingReportLayout) })
  @IsIn(Object.values(AgeingReportLayout))
  @IsOptional()
  layout?: AgeingReportLayout;

  @ApiPropertyOptional({ enum: Object.values(AgeingEefcFilter) })
  @IsIn(Object.values(AgeingEefcFilter))
  @IsOptional()
  eefcFilter?: AgeingEefcFilter;

  @ApiPropertyOptional({ enum: Object.values(AgeingScope) })
  @IsIn(Object.values(AgeingScope))
  @IsOptional()
  scope?: AgeingScope;

  @ApiPropertyOptional({
    description: "Export format",
    enum: CardSettlementReportFormat,
  })
  @IsEnum(CardSettlementReportFormat)
  @IsOptional()
  format?: CardSettlementReportFormat;
}
