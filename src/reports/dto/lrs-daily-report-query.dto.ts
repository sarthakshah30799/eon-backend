import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsBoolean,
  IsIn,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from "class-validator";

const parseArrayQuery = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const values = Array.isArray(value) ? value : String(value).split(",");
  return values.map((item) => String(item).trim()).filter(Boolean);
};

const trimQuery = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

const parseBooleanQuery = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
};

export const LrsDailyReportFormat = {
  CIMS: "cims",
  CIMS_UPLOAD: "cims_upload",
} as const;

export type LrsDailyReportFormat =
  (typeof LrsDailyReportFormat)[keyof typeof LrsDailyReportFormat];

export const LrsDailyReportExportFormat = {
  XLSX: "xlsx",
  TXT: "txt",
  PDF: "pdf",
} as const;

export type LrsDailyReportExportFormat =
  (typeof LrsDailyReportExportFormat)[keyof typeof LrsDailyReportExportFormat];

export class LrsDailyReportQueryDto {
  @ApiProperty({ description: "Start date in YYYY-MM-DD format" })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: "End date in YYYY-MM-DD format" })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ description: "Filter by branch ids", isArray: true })
  @Transform(parseArrayQuery)
  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  branchIds?: string[];

  @ApiPropertyOptional({
    description:
      "Retail public-sale product id. Omit to include every eligible product.",
  })
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({ description: "TC issuer party profile id" })
  @IsUUID()
  @IsOptional()
  issuerPartyProfileId?: string;

  @ApiPropertyOptional({
    description:
      "Purpose id. The purpose code column still shows the purpose master code.",
  })
  @IsUUID()
  @IsOptional()
  purposeId?: string;

  @ApiProperty({ description: "USD rate used to convert INR amounts" })
  @IsPositive()
  usdRate!: number;

  @ApiPropertyOptional({
    description: "On-screen and PDF layout",
    enum: Object.values(LrsDailyReportFormat),
  })
  @IsIn(Object.values(LrsDailyReportFormat))
  @IsOptional()
  reportFormat?: LrsDailyReportFormat;

  @ApiPropertyOptional({
    description:
      "Show tour passenger rows for sales that match these filters.",
  })
  @Transform(parseBooleanQuery)
  @IsBoolean()
  @IsOptional()
  showTourPaxBreakup?: boolean;

  @ApiPropertyOptional({
    description:
      "Also include party profiles whose entity type is a proprietorship firm.",
  })
  @Transform(parseBooleanQuery)
  @IsBoolean()
  @IsOptional()
  includeCorporateTransactions?: boolean;

  @ApiPropertyOptional({
    description: "Bank name printed in the CIMS upload header",
  })
  @Transform(trimQuery)
  @IsString()
  @IsOptional()
  bankName?: string;

  @ApiPropertyOptional({
    description: "Bank code printed in the CIMS upload header",
  })
  @Transform(trimQuery)
  @IsString()
  @IsOptional()
  bankCode?: string;

  @ApiPropertyOptional({
    description: "Download format",
    enum: Object.values(LrsDailyReportExportFormat),
  })
  @IsIn(Object.values(LrsDailyReportExportFormat))
  @IsOptional()
  format?: LrsDailyReportExportFormat;
}
