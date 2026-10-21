import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";
import {
  AdvanceRefundStatus,
  AdvanceRefundType,
} from "../advance-refund.enums";

export class AdvanceRefundQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Filter by branch ID (UUID)" })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ description: "Filter by party profile ID (UUID)" })
  @IsUUID()
  @IsOptional()
  partyProfileId?: string;

  @ApiPropertyOptional({ enum: AdvanceRefundType, description: "Filter by refund type" })
  @IsEnum(AdvanceRefundType)
  @IsOptional()
  refundType?: AdvanceRefundType;

  @ApiPropertyOptional({ enum: AdvanceRefundStatus, description: "Filter by status" })
  @IsEnum(AdvanceRefundStatus)
  @IsOptional()
  status?: AdvanceRefundStatus;

  @ApiPropertyOptional({ description: "Start transaction date (YYYY-MM-DD)" })
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({ description: "End transaction date (YYYY-MM-DD)" })
  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @ApiPropertyOptional({ description: "Search by number or party name" })
  @IsString()
  @IsOptional()
  search?: string;
}

export class AvailableAdvanceForRefundQueryDto {
  @ApiProperty({ description: "PAN Card Number" })
  @IsString()
  @IsNotEmpty()
  panNumber: string;

  @ApiPropertyOptional({ description: "Branch ID (UUID)" })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ description: "Party Profile ID (UUID)" })
  @IsUUID()
  @IsOptional()
  partyProfileId?: string;

  @ApiPropertyOptional({ description: "As-on Date (YYYY-MM-DD)" })
  @IsDateString()
  @IsOptional()
  asOnDate?: string;

  @ApiPropertyOptional({ description: "Search term" })
  @IsString()
  @IsOptional()
  search?: string;
}
