import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";
import { StringArrayQuery } from "../../common/transformers/parse-boolean-query";
import {
  TtSettlementDocumentKind,
  TtSettlementDocumentStatus,
} from "../tt-deal.enums";

export class TtSettlementDocumentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: TtSettlementDocumentStatus,
    isArray: true,
  })
  @StringArrayQuery()
  @IsOptional()
  @IsArray()
  @IsIn(Object.values(TtSettlementDocumentStatus), { each: true })
  status?: TtSettlementDocumentStatus[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(TtSettlementDocumentKind)
  kind?: TtSettlementDocumentKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  issuerPartyProfileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  currencyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class TtSettlementUnsettledQueryDto extends PaginationQueryDto {
  @ApiProperty()
  @IsEnum(TtSettlementDocumentKind)
  kind: TtSettlementDocumentKind;

  @ApiProperty()
  @IsUUID()
  issuerPartyProfileId: string;

  @ApiProperty()
  @IsUUID()
  currencyId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  hoBranchId?: string;
}

export class CreateTtSettlementItemDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiPropertyOptional({
    example: "68.3100000",
    description: "Required for HO_ISSUER; ignored for BRANCH_HO (uses dealRate)",
  })
  @IsOptional()
  @IsNumberString()
  rate?: string;
}

export class CreateTtSettlementDocumentDto {
  @ApiProperty({ enum: TtSettlementDocumentKind })
  @IsEnum(TtSettlementDocumentKind)
  kind: TtSettlementDocumentKind;

  @ApiProperty()
  @IsUUID()
  issuerPartyProfileId: string;

  @ApiProperty()
  @IsUUID()
  currencyId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  hoBranchId?: string;

  @ApiProperty({ example: "2026-09-22" })
  @IsDateString()
  transactionDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;

  @ApiProperty({ type: [CreateTtSettlementItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateTtSettlementItemDto)
  items: CreateTtSettlementItemDto[];
}

export class RejectTtSettlementDocumentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason: string;
}

export class CancelTtSettlementDocumentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason: string;
}
