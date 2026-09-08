import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from "class-validator";

export enum BankReportFormat {
  CSV = "csv",
  XLSX = "xlsx",
}

export enum BankReportLayout {
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

export class BankReportQueryDto {
  @ApiPropertyOptional({ description: "Start date in YYYY-MM-DD format" })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ description: "End date in YYYY-MM-DD format" })
  @IsDateString()
  endDate: string;

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
    description: "Export format",
    enum: BankReportFormat,
  })
  @IsEnum(BankReportFormat)
  @IsOptional()
  format?: BankReportFormat;
}
