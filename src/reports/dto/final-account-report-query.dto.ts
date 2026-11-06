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

export const FinalAccountReportScope = {
  BRANCH: "branch",
  CONSOLIDATED: "consolidated",
} as const;

export type FinalAccountReportScope =
  (typeof FinalAccountReportScope)[keyof typeof FinalAccountReportScope];

export const FinalAccountStatementType = {
  TRADING: "trading",
  PROFIT_AND_LOSS: "profit-and-loss",
  BALANCE_SHEET: "balance-sheet",
  MERGE_PROFIT: "merge-profit",
} as const;

export type FinalAccountStatementType =
  (typeof FinalAccountStatementType)[keyof typeof FinalAccountStatementType];

export class FinalAccountReportQueryDto {
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
    enum: Object.values(FinalAccountReportScope),
  })
  @IsIn(Object.values(FinalAccountReportScope))
  @IsOptional()
  scope?: FinalAccountReportScope;

  @ApiPropertyOptional({
    enum: Object.values(FinalAccountStatementType),
  })
  @IsIn(Object.values(FinalAccountStatementType))
  @IsOptional()
  statementType?: FinalAccountStatementType;

  @ApiPropertyOptional({
    description: "Export format",
    enum: CardSettlementReportFormat,
  })
  @IsEnum(CardSettlementReportFormat)
  @IsOptional()
  format?: CardSettlementReportFormat;
}
