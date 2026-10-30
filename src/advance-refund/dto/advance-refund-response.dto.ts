import { ApiProperty } from "@nestjs/swagger";
import {
  AdvanceRefundPayoutSource,
  AdvanceRefundStatus,
  AdvanceRefundType,
} from "../advance-refund.enums";
import { AdvanceRefund } from "../entities/advance-refund.entity";
import { AdvanceRefundItem } from "../entities/advance-refund-item.entity";

export class AdvanceRefundItemResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() advanceRefundId: string;
  @ApiProperty() lineNo: number;
  @ApiProperty() receiptVoucherId: string;
  @ApiProperty() receiptVoucherSnapshot: Record<string, any>;
  @ApiProperty() originalReceiptAmount: string;
  @ApiProperty() consumedAmount: string;
  @ApiProperty() availableAmount: string;
  @ApiProperty() refundAmount: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(entity: AdvanceRefundItem): AdvanceRefundItemResponseDto {
    const dto = new AdvanceRefundItemResponseDto();
    dto.id = entity.id;
    dto.advanceRefundId = entity.advanceRefundId;
    dto.lineNo = entity.lineNo;
    dto.receiptVoucherId = entity.receiptVoucherId;
    dto.receiptVoucherSnapshot = entity.receiptVoucherSnapshot;
    dto.originalReceiptAmount = entity.originalReceiptAmount;
    dto.consumedAmount = entity.consumedAmount;
    dto.availableAmount = entity.availableAmount;
    dto.refundAmount = entity.refundAmount;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}

export class AdvanceRefundResponseDto {
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
  @ApiProperty({ enum: AdvanceRefundType }) refundType: AdvanceRefundType;
  @ApiProperty({ enum: AdvanceRefundStatus }) status: AdvanceRefundStatus;
  @ApiProperty() totalRefundAmount: string;
  @ApiProperty() narration: string;
  @ApiProperty({ nullable: true }) remarkOptionId: string | null;
  @ApiProperty({ nullable: true }) remarkSnapshot: Record<string, any> | null;
  @ApiProperty({ nullable: true }) knockOffAccountId: string | null;
  @ApiProperty({ nullable: true }) knockOffAccountSnapshot: Record<string, any> | null;
  @ApiProperty({ enum: AdvanceRefundPayoutSource, nullable: true }) payoutSource: AdvanceRefundPayoutSource | null;
  @ApiProperty({ nullable: true }) payingBankAccountId: string | null;
  @ApiProperty({ nullable: true }) payingBankAccountSnapshot: Record<string, any> | null;
  @ApiProperty({ nullable: true }) paymentMethod: string | null;
  @ApiProperty({ nullable: true }) beneficiaryAccountNumber: string | null;
  @ApiProperty({ nullable: true }) beneficiaryIfscCode: string | null;
  @ApiProperty({ nullable: true }) beneficiaryName: string | null;
  @ApiProperty({ nullable: true }) bankName: string | null;
  @ApiProperty({ nullable: true }) chequeNumber: string | null;
  @ApiProperty({ nullable: true }) chequeDate: string | null;
  @ApiProperty({ nullable: true }) drawnOn: string | null;
  @ApiProperty({ nullable: true }) journalVoucherId: string | null;
  @ApiProperty({ nullable: true }) paymentVoucherId: string | null;
  @ApiProperty({ nullable: true }) adviceVoucherId: string | null;
  @ApiProperty({ nullable: true }) hoPaymentVoucherId: string | null;
  @ApiProperty() printCount: number;
  @ApiProperty({ type: [AdvanceRefundItemResponseDto] }) items: AdvanceRefundItemResponseDto[];
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(entity: AdvanceRefund): AdvanceRefundResponseDto {
    const dto = new AdvanceRefundResponseDto();
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
    dto.refundType = entity.refundType;
    dto.status = entity.status;
    dto.totalRefundAmount = entity.totalRefundAmount;
    dto.narration = entity.narration;
    dto.remarkOptionId = entity.remarkOptionId;
    dto.remarkSnapshot = entity.remarkSnapshot;
    dto.knockOffAccountId = entity.knockOffAccountId;
    dto.knockOffAccountSnapshot = entity.knockOffAccountSnapshot;
    dto.payoutSource = entity.payoutSource;
    dto.payingBankAccountId = entity.payingBankAccountId;
    dto.payingBankAccountSnapshot = entity.payingBankAccountSnapshot;
    dto.paymentMethod = entity.paymentMethod;
    dto.beneficiaryAccountNumber = entity.beneficiaryAccountNumber;
    dto.beneficiaryIfscCode = entity.beneficiaryIfscCode;
    dto.beneficiaryName = entity.beneficiaryName;
    dto.bankName = entity.bankName;
    dto.chequeNumber = entity.chequeNumber;
    dto.chequeDate = entity.chequeDate;
    dto.drawnOn = entity.drawnOn;
    dto.journalVoucherId = entity.journalVoucherId;
    dto.paymentVoucherId = entity.paymentVoucherId;
    dto.adviceVoucherId = entity.adviceVoucherId;
    dto.hoPaymentVoucherId = entity.hoPaymentVoucherId;
    dto.printCount = entity.printCount ?? 0;
    dto.items = Array.isArray(entity.items)
      ? entity.items.map((i) => AdvanceRefundItemResponseDto.fromEntity(i))
      : [];
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
