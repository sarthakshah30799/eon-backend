import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString } from "class-validator";
import { ReportSortBy } from "./report-sort.dto";

export enum SpecialReportTemplateEnum {
  ACCOUNT_POSTING = "ACCOUNT_POSTING",
}

export enum SpecialReportFormat {
  CSV = "csv",
  XLSX = "xlsx",
}

const parseArrayQuery = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const values = Array.isArray(value) ? value : String(value).split(",");
  return values
    .map(item => String(item).trim())
    .filter(Boolean);
};

export class SpecialReportQueryDto {
  @ApiProperty({
    description: "Filter by branch ids",
    isArray: true,
  })
  @Transform(parseArrayQuery)
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  branchIds!: string[];

  @ApiPropertyOptional({
    description: "Special report template",
    enum: SpecialReportTemplateEnum,
    default: SpecialReportTemplateEnum.ACCOUNT_POSTING,
  })
  @IsEnum(SpecialReportTemplateEnum)
  @IsOptional()
  template?: SpecialReportTemplateEnum;

  @ApiPropertyOptional({
    description: "Filter by transaction numbers",
    isArray: true,
  })
  @Transform(parseArrayQuery)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  transactionNumbers?: string[];

  @ApiPropertyOptional({
    description: "Sort order",
    enum: ReportSortBy,
    default: ReportSortBy.DATE_ASC,
  })
  @IsEnum(ReportSortBy)
  @IsOptional()
  sortBy?: ReportSortBy;

  @ApiPropertyOptional({
    description: "Export format",
    enum: SpecialReportFormat,
  })
  @IsEnum(SpecialReportFormat)
  @IsOptional()
  format?: SpecialReportFormat;
}
