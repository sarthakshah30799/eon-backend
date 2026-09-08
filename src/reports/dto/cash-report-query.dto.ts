import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from "class-validator";

export enum CashReportFormat {
  CSV = "csv",
  XLSX = "xlsx",
}

export enum CashReportLayout {
  BRANCH_WISE = "BRANCH_WISE",
  CONSOLIDATED = "CONSOLIDATED",
}

const parseArrayQuery = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const values = Array.isArray(value) ? value : String(value).split(",");
  return values.map((item) => String(item).trim()).filter(Boolean);
};

export class CashReportQueryDto {
  @ApiPropertyOptional({ description: "Start date in YYYY-MM-DD format" })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ description: "End date in YYYY-MM-DD format" })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    description: "BRANCH_WISE or CONSOLIDATED",
    enum: CashReportLayout,
  })
  @IsEnum(CashReportLayout)
  @IsOptional()
  layout?: CashReportLayout;

  @ApiPropertyOptional({ description: "Filter by branch ids", isArray: true })
  @Transform(parseArrayQuery)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  branchIds?: string[];

  @ApiPropertyOptional({
    description: "Filter by cash ledger account ids",
    isArray: true,
  })
  @Transform(parseArrayQuery)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  accountIds?: string[];

  @ApiPropertyOptional({
    description: "Export format",
    enum: CashReportFormat,
  })
  @IsEnum(CashReportFormat)
  @IsOptional()
  format?: CashReportFormat;
}
