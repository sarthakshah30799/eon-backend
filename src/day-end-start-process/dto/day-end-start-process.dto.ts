import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { MonthlyLockWindowResponseDto } from "../../monthly-locks/dto/monthly-lock-window.dto";

export class CompleteDayEndDto {
  @ApiPropertyOptional({ description: "Target branch for Admin/HO operations" })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: "Checklist answers as a JSON object" })
  @IsOptional()
  answers?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      "IANA time zone of the client PC used to resolve the business calendar day",
    example: "Asia/Kolkata",
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone?: string;

  @ApiPropertyOptional({
    description:
      "Client PC current instant (ISO-8601). Used with timeZone to resolve the business calendar day from the browser clock.",
    example: "2026-10-02T04:30:00.000Z",
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  clientNow?: string;
}

export class PolicyChecklistItemDto {
  @ApiProperty()
  code: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  valueType: string;

  @ApiProperty()
  required: boolean;
}

export class DayEndStartProcessContextDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  branchId: string;

  @ApiProperty()
  counterId: string;

  @ApiProperty()
  currentBusinessDate: string;

  @ApiProperty()
  transactionDate: string;

  @ApiProperty()
  eodIncomplete: boolean;

  @ApiProperty()
  bodCompleted: boolean;

  @ApiProperty()
  canStartDay: boolean;

  @ApiProperty()
  canCompleteDayEnd: boolean;

  @ApiProperty()
  openBusinessDate: string;

  @ApiProperty()
  workflowState: string;

  @ApiPropertyOptional({
    description: "IANA time zone used to resolve the business calendar day",
    example: "Asia/Kolkata",
  })
  timeZone?: string;

  @ApiPropertyOptional({
    description: "UTC timestamp when BOD was completed (ISO-8601)",
  })
  bodAt?: string | null;

  @ApiPropertyOptional({
    description: "UTC timestamp when EOD was completed (ISO-8601)",
  })
  eodAt?: string | null;

  @ApiPropertyOptional()
  activeMonthlyLock?: MonthlyLockWindowResponseDto | null;

  @ApiPropertyOptional()
  activeBackdateWindow?: MonthlyLockWindowResponseDto | null;

  @ApiPropertyOptional({
    description:
      "Branch data lock from FLM 8. Punching on this date or earlier is blocked.",
  })
  transactionDataLock?: {
    lockedThroughDate: string;
  } | null;

  @ApiProperty({ type: [PolicyChecklistItemDto] })
  checklist: PolicyChecklistItemDto[];
}
