import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString } from "class-validator";

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
    description: "Export format",
    enum: SpecialReportFormat,
  })
  @IsEnum(SpecialReportFormat)
  @IsOptional()
  format?: SpecialReportFormat;
}
