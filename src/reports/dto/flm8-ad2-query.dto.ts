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

export const Flm8Ad2ReportFormat = {
  CURRENCY: "currency",
  PURPOSE: "purpose",
  PARTY: "party",
} as const;

export type Flm8Ad2ReportFormat =
  (typeof Flm8Ad2ReportFormat)[keyof typeof Flm8Ad2ReportFormat];

export class Flm8Ad2QueryDto {
  @ApiProperty({ description: "Start date in YYYY-MM-DD format" })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: "End date in YYYY-MM-DD format" })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ description: "Filter by branch ids", isArray: true })
  @StringArrayQuery()
  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  branchIds?: string[];

  @ApiPropertyOptional({
    description: "currency, purpose, or party",
    enum: Object.values(Flm8Ad2ReportFormat),
  })
  @IsIn(Object.values(Flm8Ad2ReportFormat))
  @IsOptional()
  reportFormat?: Flm8Ad2ReportFormat;

  @ApiPropertyOptional({
    description:
      "When true, currency columns use the currency name and country from the currency master.",
  })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  apConnect?: boolean;

  @ApiPropertyOptional({
    description: "Export format",
    enum: CardSettlementReportFormat,
  })
  @IsEnum(CardSettlementReportFormat)
  @IsOptional()
  format?: CardSettlementReportFormat;
}
