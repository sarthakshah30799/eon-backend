import { ApiProperty } from "@nestjs/swagger";
import {
  AdvanceAdjustmentPrintCopyType,
  AdvanceAdjustmentStatus,
} from "../advance-adjustment.enums";
import { AdvanceAdjustment } from "../entities/advance-adjustment.entity";
import { AdvanceAdjustmentItem } from "../entities/advance-adjustment-item.entity";
import { AdvanceAdjustmentPrintLog } from "../entities/advance-adjustment-print-log.entity";

export class AdvanceAdjustmentPrintLogResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() advanceAdjustmentId: string;
  @ApiProperty({ enum: AdvanceAdjustmentPrintCopyType })
  copyType: AdvanceAdjustmentPrintCopyType;
  @ApiProperty() message: string;
  @ApiProperty({ nullable: true }) metadata: Record<string, unknown> | null;
  @ApiProperty({ nullable: true }) performedById: string | null;
  @ApiProperty({ nullable: true }) performedByName: string | null;
  @ApiProperty() performedAt: Date;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(
    entity: AdvanceAdjustmentPrintLog,
  ): AdvanceAdjustmentPrintLogResponseDto {
    const dto = new AdvanceAdjustmentPrintLogResponseDto();
    dto.id = entity.id;
    dto.advanceAdjustmentId = entity.advanceAdjustmentId;
    dto.copyType = entity.copyType;
    dto.message = entity.message;
    dto.metadata = entity.metadata;
    dto.performedById = entity.performedById;
    dto.performedByName = entity.performedByName;
    dto.performedAt = entity.performedAt;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}

export class AdvanceAdjustmentItemResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() advanceAdjustmentId: string;
  @ApiProperty() lineNo: number;
  @ApiProperty() transactionId: string;
  @ApiProperty() transactionSnapshot: Record<string, any>;
  @ApiProperty() finalAmount: string;
  @ApiProperty() outstandingAmount: string;
  @ApiProperty() adjustmentAmount: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(
    entity: AdvanceAdjustmentItem,
  ): AdvanceAdjustmentItemResponseDto {
    const dto = new AdvanceAdjustmentItemResponseDto();
    dto.id = entity.id;
    dto.advanceAdjustmentId = entity.advanceAdjustmentId;
    dto.lineNo = entity.lineNo;
    dto.transactionId = entity.transactionId;
    dto.transactionSnapshot = entity.transactionSnapshot;
    dto.finalAmount = entity.finalAmount;
    dto.outstandingAmount = entity.outstandingAmount;
    dto.adjustmentAmount = entity.adjustmentAmount;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}

export class AdvanceAdjustmentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() number: string;
  @ApiProperty() branchId: string;
  @ApiProperty() branchSnapshot: Record<string, any>;
  @ApiProperty() counterId: string;
  @ApiProperty() counterSnapshot: Record<string, any>;
  @ApiProperty() transactionDate: string;
  @ApiProperty() asOnDate: string;
  @ApiProperty() partyProfileId: string;
  @ApiProperty() partyProfileSnapshot: Record<string, any>;
  @ApiProperty({ nullable: true }) panNumber: string | null;
  @ApiProperty({ nullable: true }) panName: string | null;
  @ApiProperty({ nullable: true }) panDob: string | null;
  @ApiProperty({ enum: AdvanceAdjustmentStatus })
  status: AdvanceAdjustmentStatus;
  @ApiProperty() totalAdjustmentAmount: string;
  @ApiProperty() narration: string;
  @ApiProperty() printCount: number;
  @ApiProperty({ type: [AdvanceAdjustmentPrintLogResponseDto] })
  printLogs: AdvanceAdjustmentPrintLogResponseDto[];
  @ApiProperty({ type: [AdvanceAdjustmentItemResponseDto] })
  items: AdvanceAdjustmentItemResponseDto[];
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(entity: AdvanceAdjustment): AdvanceAdjustmentResponseDto {
    const dto = new AdvanceAdjustmentResponseDto();
    dto.id = entity.id;
    dto.number = entity.number;
    dto.branchId = entity.branchId;
    dto.branchSnapshot = entity.branchSnapshot;
    dto.counterId = entity.counterId;
    dto.counterSnapshot = entity.counterSnapshot;
    dto.transactionDate = entity.transactionDate;
    dto.asOnDate = entity.asOnDate;
    dto.partyProfileId = entity.partyProfileId;
    dto.partyProfileSnapshot = entity.partyProfileSnapshot;
    dto.panNumber = entity.panNumber;
    dto.panName = entity.panName;
    dto.panDob = entity.panDob;
    dto.status = entity.status;
    dto.totalAdjustmentAmount = entity.totalAdjustmentAmount;
    dto.narration = entity.narration;
    dto.printCount = entity.printCount ?? 0;
    dto.printLogs = Array.isArray(entity.printLogs)
      ? entity.printLogs.map((log) =>
          AdvanceAdjustmentPrintLogResponseDto.fromEntity(log),
        )
      : [];
    dto.items = Array.isArray(entity.items)
      ? entity.items.map((i) => AdvanceAdjustmentItemResponseDto.fromEntity(i))
      : [];
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}

export class OutstandingSaleForAdjustmentDto {
  @ApiProperty() id: string;
  @ApiProperty() number: string;
  @ApiProperty() transactionDate: string;
  @ApiProperty() transactionType: string;
  @ApiProperty() slug: string;
  @ApiProperty() partyProfileId: string;
  @ApiProperty({ nullable: true }) partyProfileSnapshot: Record<string, any> | null;
  @ApiProperty() finalAmount: string;
  @ApiProperty({ nullable: true }) byCash: string | null;
  @ApiProperty({ nullable: true }) byCheque: string | null;
  @ApiProperty({ nullable: true }) byCard: string | null;
  @ApiProperty({ nullable: true }) byTransfer: string | null;
  @ApiProperty({ nullable: true }) byOther: string | null;
  @ApiProperty() outstanding: string;
  @ApiProperty() branchId: string;
}
