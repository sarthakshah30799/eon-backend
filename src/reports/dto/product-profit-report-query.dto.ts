import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from "class-validator";

export enum ProductProfitReportFormat {
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

export class ProductProfitReportQueryDto {
  @ApiPropertyOptional({ description: "Start date in YYYY-MM-DD format" })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: "End date in YYYY-MM-DD format" })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description: "Filter by branch ids",
    isArray: true,
  })
  @Transform(parseArrayQuery)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  branchIds?: string[];

  @ApiPropertyOptional({
    description: "Filter by state ids",
    isArray: true,
  })
  @Transform(parseArrayQuery)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  stateIds?: string[];

  @ApiPropertyOptional({
    description: "Filter by counter ids",
    isArray: true,
  })
  @Transform(parseArrayQuery)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  counterIds?: string[];

  @ApiPropertyOptional({
    description: "Filter by party profile ids",
    isArray: true,
  })
  @Transform(parseArrayQuery)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  partyProfileIds?: string[];

  @ApiPropertyOptional({
    description: "Filter by party profile types",
    isArray: true,
  })
  @Transform(parseArrayQuery)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  partyTypeCodes?: string[];

  @ApiPropertyOptional({
    description: "Filter by currency ids",
    isArray: true,
  })
  @Transform(parseArrayQuery)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  currencyIds?: string[];

  @ApiPropertyOptional({
    description: "Filter by product ids",
    isArray: true,
  })
  @Transform(parseArrayQuery)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  productIds?: string[];

  @ApiPropertyOptional({
    description: "Export format",
    enum: ProductProfitReportFormat,
  })
  @IsEnum(ProductProfitReportFormat)
  @IsOptional()
  format?: ProductProfitReportFormat;
}
