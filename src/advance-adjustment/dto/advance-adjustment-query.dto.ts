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
import { AdvanceAdjustmentStatus } from "../advance-adjustment.enums";

export class AdvanceAdjustmentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Filter by branch ID (UUID)" })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ description: "Filter by party profile ID (UUID)" })
  @IsUUID()
  @IsOptional()
  partyProfileId?: string;

  @ApiPropertyOptional({
    enum: AdvanceAdjustmentStatus,
    description: "Filter by status",
  })
  @IsEnum(AdvanceAdjustmentStatus)
  @IsOptional()
  status?: AdvanceAdjustmentStatus;

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

export class OutstandingSalesForAdjustmentQueryDto extends PaginationQueryDto {
  @ApiProperty({ description: "Branch ID (UUID)" })
  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({ description: "Counter ID (UUID)" })
  @IsUUID()
  @IsNotEmpty()
  counterId: string;

  @ApiProperty({ description: "Party Profile ID (UUID)" })
  @IsUUID()
  @IsNotEmpty()
  partyProfileId: string;

  @ApiProperty({ description: "As-on Date (YYYY-MM-DD)" })
  @IsDateString()
  @IsNotEmpty()
  asOnDate: string;

  @ApiPropertyOptional({ description: "Search by sale number" })
  @IsString()
  @IsOptional()
  search?: string;
}
