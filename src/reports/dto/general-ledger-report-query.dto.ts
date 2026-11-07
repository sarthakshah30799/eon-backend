import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { StringArrayQuery } from "../../common/transformers/parse-boolean-query";
import { CardSettlementReportFormat } from "./card-settlement-report-query.dto";

export const GeneralLedgerReportLayout = {
  DETAIL: "detail",
  SUMMARY: "summary",
} as const;

export type GeneralLedgerReportLayout =
  (typeof GeneralLedgerReportLayout)[keyof typeof GeneralLedgerReportLayout];

export const GeneralLedgerReportScope = {
  BRANCH: "branch",
  CONSOLIDATED: "consolidated",
} as const;

export type GeneralLedgerReportScope =
  (typeof GeneralLedgerReportScope)[keyof typeof GeneralLedgerReportScope];

export const GeneralLedgerReportView = {
  LEDGER: "ledger",
  COLUMNAR: "columnar",
} as const;

export type GeneralLedgerReportView =
  (typeof GeneralLedgerReportView)[keyof typeof GeneralLedgerReportView];

export class GeneralLedgerReportQueryDto {
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
    description: "Filter by account profile ids (Type)",
    isArray: true,
  })
  @StringArrayQuery()
  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  accountIds?: string[];

  @ApiPropertyOptional({
    enum: Object.values(GeneralLedgerReportLayout),
  })
  @IsIn(Object.values(GeneralLedgerReportLayout))
  @IsOptional()
  layout?: GeneralLedgerReportLayout;

  @ApiPropertyOptional({
    enum: Object.values(GeneralLedgerReportScope),
  })
  @IsIn(Object.values(GeneralLedgerReportScope))
  @IsOptional()
  scope?: GeneralLedgerReportScope;

  @ApiPropertyOptional({
    enum: Object.values(GeneralLedgerReportView),
  })
  @IsIn(Object.values(GeneralLedgerReportView))
  @IsOptional()
  view?: GeneralLedgerReportView;

  @ApiPropertyOptional({
    description:
      "Optional passenger name search (matches transaction passenger snapshot name fields)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  passengerName?: string;

  @ApiPropertyOptional({
    description: "Export format",
    enum: CardSettlementReportFormat,
  })
  @IsEnum(CardSettlementReportFormat)
  @IsOptional()
  format?: CardSettlementReportFormat;
}
