import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from "class-validator";
import { BooleanQuery } from "../../common/transformers/parse-boolean-query";
import { BankReportLayout } from "./bank-report-query.dto";

export enum BankReconciliationReportFormat {
  CSV = "csv",
  XLSX = "xlsx",
  PDF = "pdf",
}

const parseArrayQuery = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const values = Array.isArray(value) ? value : String(value).split(",");
  return values.map((item) => String(item).trim()).filter(Boolean);
};

export class BankReconciliationReportQueryDto {
  @ApiPropertyOptional({ description: "Start date in YYYY-MM-DD format" })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({ description: "End date in YYYY-MM-DD format" })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({
    description: "BRANCH_WISE or CONSOLIDATED",
    enum: BankReportLayout,
  })
  @IsEnum(BankReportLayout)
  @IsOptional()
  layout?: BankReportLayout;

  @ApiPropertyOptional({ description: "Filter by branch ids", isArray: true })
  @Transform(parseArrayQuery)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  branchIds?: string[];

  @ApiPropertyOptional({
    description: "Filter by bank ledger account ids",
    isArray: true,
  })
  @Transform(parseArrayQuery)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  accountIds?: string[];

  @ApiPropertyOptional({
    description:
      "When true (default), only uncleared cheque rows whose cheque date is in From–To. When false, cleared or dishonored cheque rows whose cheque date is in From–To.",
  })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  unclearedOnly?: boolean;

  @ApiPropertyOptional({
    description: "Export format",
    enum: BankReconciliationReportFormat,
  })
  @IsEnum(BankReconciliationReportFormat)
  @IsOptional()
  format?: BankReconciliationReportFormat;
}
