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

export const TtReportLayout = {
  INDUS: "indus",
  IDFC: "idfc",
  ICICI: "icici",
  YES: "yes",
} as const;

export type TtReportLayout = (typeof TtReportLayout)[keyof typeof TtReportLayout];

export class TtReportQueryDto {
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
    description: "indus uses the INDUS column layout. idfc uses the IDFC column layout.",
    enum: Object.values(TtReportLayout),
  })
  @IsIn(Object.values(TtReportLayout))
  @IsOptional()
  layout?: TtReportLayout;

  @ApiPropertyOptional({ description: "TT product id" })
  @IsUUID("4")
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({
    description: "Issuer party profile ids",
    isArray: true,
  })
  @StringArrayQuery()
  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  issuerPartyProfileIds?: string[];

  @ApiPropertyOptional({
    description:
      "Exclude already blocked rows and mark the rows in this report as blocked",
  })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  blockAfterGenerate?: boolean;

  @ApiPropertyOptional({
    description: "Include rows that were already blocked",
  })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  showBlocked?: boolean;

  @ApiPropertyOptional({
    description:
      "Only surrender TT rows transferred from the branch to HO and not yet accepted",
  })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  showBeforeHoAcceptance?: boolean;

  @ApiPropertyOptional({
    description:
      "Repeat the rows marked by the last Block Data generation, so the download matches the report on screen",
  })
  @IsDateString()
  @IsOptional()
  blockedBatchAt?: string;

  @ApiPropertyOptional({
    enum: CardSettlementReportFormat,
    description: "Export format",
  })
  @IsEnum(CardSettlementReportFormat)
  @IsOptional()
  format?: CardSettlementReportFormat;
}
