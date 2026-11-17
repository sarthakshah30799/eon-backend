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

export const CashLedgerReportScope = {
  BRANCH: "branch",
  CONSOLIDATED: "consolidated",
} as const;

export type CashLedgerReportScope =
  (typeof CashLedgerReportScope)[keyof typeof CashLedgerReportScope];

export const CashLedgerReportLayout = {
  LEDGER: "LEDGER",
  COLUMNAR: "COLUMNAR",
} as const;

export type CashLedgerReportLayout =
  (typeof CashLedgerReportLayout)[keyof typeof CashLedgerReportLayout];

export class CashLedgerReportQueryDto {
  @ApiProperty({ description: "Start date in YYYY-MM-DD format" })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: "End date in YYYY-MM-DD format" })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ description: "Filter by branch ids", isArray: true })
  @StringArrayQuery()
  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  branchIds?: string[];

  @ApiPropertyOptional({
    description: "Filter by cash ledger account ids",
    isArray: true,
  })
  @StringArrayQuery()
  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  accountIds?: string[];

  @ApiPropertyOptional({
    description: "Filter by counter ids",
    isArray: true,
  })
  @StringArrayQuery()
  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  counterIds?: string[];

  @ApiPropertyOptional({
    enum: Object.values(CashLedgerReportScope),
  })
  @IsIn(Object.values(CashLedgerReportScope))
  @IsOptional()
  scope?: CashLedgerReportScope;

  @ApiPropertyOptional({
    enum: Object.values(CashLedgerReportLayout),
  })
  @IsIn(Object.values(CashLedgerReportLayout))
  @IsOptional()
  layout?: CashLedgerReportLayout;

  @ApiPropertyOptional({
    description: "Export format",
    enum: CardSettlementReportFormat,
  })
  @IsEnum(CardSettlementReportFormat)
  @IsOptional()
  format?: CardSettlementReportFormat;
}
