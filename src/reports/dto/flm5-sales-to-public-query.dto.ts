import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsUUID,
} from "class-validator";
import { CardSettlementReportFormat } from "./card-settlement-report-query.dto";

export const Flm5SalesToPublicView = {
  NORMAL: "normal",
  EXTENDED: "extended",
} as const;

export type Flm5SalesToPublicView =
  (typeof Flm5SalesToPublicView)[keyof typeof Flm5SalesToPublicView];

const parseArrayQuery = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const values = Array.isArray(value) ? value : String(value).split(",");
  return values.map((item) => String(item).trim()).filter(Boolean);
};

export class Flm5SalesToPublicQueryDto {
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

  @ApiPropertyOptional({
    description: "Report view",
    enum: Object.values(Flm5SalesToPublicView),
  })
  @IsIn(Object.values(Flm5SalesToPublicView))
  @IsOptional()
  view?: Flm5SalesToPublicView;

  @ApiPropertyOptional({
    description: "Export format",
    enum: CardSettlementReportFormat,
  })
  @IsEnum(CardSettlementReportFormat)
  @IsOptional()
  format?: CardSettlementReportFormat;
}
