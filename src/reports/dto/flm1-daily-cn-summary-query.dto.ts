import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
} from "class-validator";
import { CardSettlementReportFormat } from "./card-settlement-report-query.dto";

const parseArrayQuery = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const values = Array.isArray(value) ? value : String(value).split(",");
  return values.map((item) => String(item).trim()).filter(Boolean);
};

export class Flm1DailyCnSummaryQueryDto {
  @ApiPropertyOptional({ description: "Report date in YYYY-MM-DD format" })
  @IsDateString()
  @IsOptional()
  date?: string;

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

  @ApiPropertyOptional({
    description: "Export format",
    enum: CardSettlementReportFormat,
  })
  @IsEnum(CardSettlementReportFormat)
  @IsOptional()
  format?: CardSettlementReportFormat;
}
