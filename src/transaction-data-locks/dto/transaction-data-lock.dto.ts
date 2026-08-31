import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsOptional,
  IsUUID,
} from "class-validator";

export class CreateTransactionDataLocksDto {
  @ApiProperty({
    description:
      "FLM 8 report end date used as the lock-through date (inclusive)",
  })
  @IsDateString()
  lockedThroughDate: string;

  @ApiProperty({
    type: [String],
    description:
      "Branch ids to lock. Empty/omitted is not allowed; client must send resolved list.",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  branchIds: string[];

  @ApiPropertyOptional({ description: "FLM 8 report start date for audit" })
  @IsDateString()
  @IsOptional()
  reportStartDate?: string;

  @ApiPropertyOptional({ description: "FLM 8 report end date for audit" })
  @IsDateString()
  @IsOptional()
  reportEndDate?: string;
}

export class TransactionDataLockResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  branchId: string;

  @ApiPropertyOptional()
  branchName?: string | null;

  @ApiProperty()
  lockedThroughDate: string;

  @ApiProperty()
  lockedAt: string;

  @ApiProperty()
  lockedBy: string;

  @ApiPropertyOptional()
  reportStartDate?: string | null;

  @ApiPropertyOptional()
  reportEndDate?: string | null;

  @ApiPropertyOptional()
  status?: "created" | "advanced" | "unchanged" | "skipped";

  @ApiPropertyOptional()
  message?: string;
}

export class CreateTransactionDataLocksResultDto {
  @ApiProperty({ type: [TransactionDataLockResponseDto] })
  @Type(() => TransactionDataLockResponseDto)
  results: TransactionDataLockResponseDto[];
}
