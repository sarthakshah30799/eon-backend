import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";
import { TransactionType } from "../../transactions/transactions.enums";
import { PurposePartyProfileType } from "../purpose.enums";

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

export class PurposeListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Search code, RBI code, or description",
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    enum: TransactionType,
    description: "Filter by transaction type",
  })
  @IsEnum(TransactionType)
  @IsOptional()
  transactionType?: TransactionType;

  @ApiPropertyOptional({
    enum: PurposePartyProfileType,
    description: "Filter by party profile type",
  })
  @IsEnum(PurposePartyProfileType)
  @IsOptional()
  partyProfileType?: PurposePartyProfileType;

  @ApiPropertyOptional({
    description: "Return only purposes that have an RBI code",
  })
  @Transform(parseBooleanQuery)
  @IsBoolean()
  @IsOptional()
  hasRbiCode?: boolean;
}
