import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from "class-validator";

export enum TradingSummaryReportFormat {
  CSV = "csv",
  XLSX = "xlsx",
}

export enum TradingSummaryReportScope {
  BRANCH = "branch",
  CONSOLIDATED = "consolidated",
}

export enum TradingSummaryDiffFilter {
  HAS_DIFF = "has_diff",
  NO_DIFF = "no_diff",
}

const parseArrayQuery = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const values = Array.isArray(value) ? value : String(value).split(",");
  return values.map((item) => String(item).trim()).filter(Boolean);
};

export class TradingSummaryReportQueryDto {
  @ApiProperty({ description: "Start date in YYYY-MM-DD format" })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: "End date in YYYY-MM-DD format" })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ description: "Filter by branch ids", isArray: true })
  @Transform(parseArrayQuery)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  branchIds?: string[];

  @ApiPropertyOptional({
    description: "branch or consolidated",
    enum: TradingSummaryReportScope,
  })
  @IsEnum(TradingSummaryReportScope)
  @IsOptional()
  scope?: TradingSummaryReportScope;

  @ApiPropertyOptional({
    description:
      "has_diff = only rows with non-zero difference; no_diff = only balanced rows",
    enum: TradingSummaryDiffFilter,
  })
  @IsEnum(TradingSummaryDiffFilter)
  @IsOptional()
  diffFilter?: TradingSummaryDiffFilter;

  @ApiPropertyOptional({
    description: "Export format",
    enum: TradingSummaryReportFormat,
  })
  @IsEnum(TradingSummaryReportFormat)
  @IsOptional()
  format?: TradingSummaryReportFormat;
}
