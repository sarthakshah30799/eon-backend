import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsDateString, IsEnum, IsOptional, IsUUID } from "class-validator";
import { StringArrayQuery } from "../../common/transformers/parse-boolean-query";
import { CardSettlementReportFormat } from "./card-settlement-report-query.dto";

export class TourPaxReportQueryDto {
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
    description: "Export format",
    enum: CardSettlementReportFormat,
  })
  @IsEnum(CardSettlementReportFormat)
  @IsOptional()
  format?: CardSettlementReportFormat;
}
