import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";
import { MonthlyLockWindowResponseDto } from "../../monthly-locks/dto/monthly-lock-window.dto";

export class CompleteDayEndDto {
  @ApiPropertyOptional({ description: "Target branch for Admin/HO operations" })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: "Target counter for Admin/HO operations" })
  @IsOptional()
  @IsUUID()
  counterId?: string;

  @ApiPropertyOptional({ description: "Checklist answers as a JSON object" })
  @IsOptional()
  answers?: Record<string, unknown>;
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

  @ApiPropertyOptional()
  activeMonthlyLock?: MonthlyLockWindowResponseDto | null;

  @ApiPropertyOptional()
  activeBackdateWindow?: MonthlyLockWindowResponseDto | null;

  @ApiProperty({ type: [PolicyChecklistItemDto] })
  checklist: PolicyChecklistItemDto[];
}
