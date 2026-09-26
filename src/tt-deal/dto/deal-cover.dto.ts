import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";
import { StringArrayQuery } from "../../common/transformers/parse-boolean-query";
import { ClientType } from "../../party-profiles/party-profile.entity";
import { DealCoverStatus } from "../deal-cover.enums";

export class CreateDealCoverDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ example: "2026-09-22" })
  @IsDateString()
  transactionDate: string;

  @ApiProperty()
  @IsUUID()
  bankAccountProfileId: string;

  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty({ enum: ClientType })
  @IsEnum(ClientType)
  partyProfileType: ClientType;

  @ApiProperty()
  @IsUUID()
  partyProfileId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  marketingExecutiveId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  passengerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  passengerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  passengerPan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  passengerPanHolder?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  passengerPanDob?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  passengerPassport?: string;

  @ApiProperty()
  @IsUUID()
  purposeId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subpurposeId?: string;

  @ApiProperty()
  @IsUUID()
  currencyId: string;

  @ApiProperty()
  @IsUUID()
  issuerPartyProfileId: string;

  @ApiProperty({ example: "1000.00" })
  @IsNumberString()
  feAmount: string;

  @ApiPropertyOptional({ example: "0.00", default: "0" })
  @IsOptional()
  @IsNumberString()
  fbChargeAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  narration?: string;

  @ApiProperty()
  @IsUUID()
  maturityOptionId: string;
}

export class UpdateDealCoverDto extends PartialType(CreateDealCoverDto) {}

export class DealCoverListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: DealCoverStatus,
    isArray: true,
    description: "Filter by one or more deal statuses",
  })
  @StringArrayQuery()
  @IsOptional()
  @IsArray()
  @IsIn(Object.values(DealCoverStatus), { each: true })
  status?: DealCoverStatus[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  bankAccountProfileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  currencyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  issuerPartyProfileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  partyProfileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    description: "When true, only unconsumed deals within maturity as of asOfDate",
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true" || value === "1")
  forPunch?: boolean;

  @ApiPropertyOptional({ example: "2026-09-23" })
  @IsOptional()
  @IsDateString()
  asOfDate?: string;
}

export class DealCoverAckListQueryDto extends DealCoverListQueryDto {}

export class ApproveDealCoverDto {
  @ApiProperty({ example: "DEAL-001" })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  dealNo: string;

  @ApiProperty({ example: "68.2500000" })
  @IsNumberString()
  bookingRate: string;
}

export class RejectDealCoverDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason: string;
}

export class BulkApproveDealCoverItemDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  dealNo: string;

  @ApiProperty()
  @IsNumberString()
  bookingRate: string;
}

export class BulkApproveDealCoverDto {
  @ApiProperty({ type: [BulkApproveDealCoverItemDto] })
  @Type(() => BulkApproveDealCoverItemDto)
  @IsArray()
  items: BulkApproveDealCoverItemDto[];
}
