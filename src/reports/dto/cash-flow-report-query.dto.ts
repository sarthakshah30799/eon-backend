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

export const CashFlowReportScope = {
  BRANCH: "branch",
  CONSOLIDATED: "consolidated",
} as const;

export type CashFlowReportScope =
  (typeof CashFlowReportScope)[keyof typeof CashFlowReportScope];

export class CashFlowReportQueryDto {
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
    description: "Filter by bank/cash ledger account ids",
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
    enum: Object.values(CashFlowReportScope),
  })
  @IsIn(Object.values(CashFlowReportScope))
  @IsOptional()
  scope?: CashFlowReportScope;

  @ApiPropertyOptional({
    description: "Export format",
    enum: CardSettlementReportFormat,
  })
  @IsEnum(CardSettlementReportFormat)
  @IsOptional()
  format?: CardSettlementReportFormat;
}
