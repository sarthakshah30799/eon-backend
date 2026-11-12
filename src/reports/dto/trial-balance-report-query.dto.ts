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

export const TrialBalanceReportScope = {
  BRANCH: "branch",
  CONSOLIDATED: "consolidated",
} as const;

export type TrialBalanceReportScope =
  (typeof TrialBalanceReportScope)[keyof typeof TrialBalanceReportScope];

export class TrialBalanceReportQueryDto {
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
    enum: Object.values(TrialBalanceReportScope),
  })
  @IsIn(Object.values(TrialBalanceReportScope))
  @IsOptional()
  scope?: TrialBalanceReportScope;

  @ApiPropertyOptional({
    description:
      "When true, nest rows by financial type then financial code with code totals",
  })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  groupBy?: boolean;

  @ApiPropertyOptional({
    description:
      "When true, fold PRO* profit accounts into SAL*/SELL* (sale-time) or PUR* (purchase-time settlement) lines using product snapshots/masters.",
  })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  mergeProfit?: boolean;

  @ApiPropertyOptional({
    description: "Export format",
    enum: CardSettlementReportFormat,
  })
  @IsEnum(CardSettlementReportFormat)
  @IsOptional()
  format?: CardSettlementReportFormat;
}
