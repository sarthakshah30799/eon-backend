import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from "class-validator";
import { PurposeGroupProfileType } from "../../purpose/purpose.enums";
import { CardSettlementReportFormat } from "./card-settlement-report-query.dto";

export const Flm8CnStatementView = {
  VERTICAL: "vertical",
  HORIZONTAL: "horizontal",
} as const;

export type Flm8CnStatementView =
  (typeof Flm8CnStatementView)[keyof typeof Flm8CnStatementView];

const parseArrayQuery = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const values = Array.isArray(value) ? value : String(value).split(",");
  return values.map((item) => String(item).trim()).filter(Boolean);
};

const parseBooleanQuery = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }
  return undefined;
};

export class Flm8CnStatementQueryDto {
  @ApiPropertyOptional({ description: "Start date in YYYY-MM-DD format" })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: "End date in YYYY-MM-DD format" })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: "Filter by branch ids", isArray: true })
  @Transform(parseArrayQuery)
  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  branchIds?: string[];

  @ApiPropertyOptional({ description: "Product id. Defaults to CN when omitted." })
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiProperty({
    enum: PurposeGroupProfileType,
    description: "Required FFMC or AD profile used to load sell purpose groups",
  })
  @IsEnum(PurposeGroupProfileType)
  @IsNotEmpty()
  profileType: PurposeGroupProfileType;

  @ApiPropertyOptional({
    description: "Report layout. Vertical matches FLM 1. Horizontal lists currency as a column.",
    enum: Object.values(Flm8CnStatementView),
  })
  @IsIn(Object.values(Flm8CnStatementView))
  @IsOptional()
  view?: Flm8CnStatementView;

  @ApiPropertyOptional({
    description:
      "AD only. When true, currency labels use currency name and country name from masters (Name(Country)).",
  })
  @Transform(parseBooleanQuery)
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
