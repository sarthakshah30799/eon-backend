import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ClientType } from "../../party-profiles/party-profile.entity";
import { TransactionReferenceSnapshotValue } from "../../transactions/types/transaction-snapshot.types";
import { DealCover } from "../entities/deal-cover.entity";
import { DealCoverStatus } from "../deal-cover.enums";

export class DealCoverResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  branchId: string;

  @ApiPropertyOptional({ nullable: true })
  branchSnapshot: TransactionReferenceSnapshotValue;

  @ApiProperty()
  transactionDate: Date;

  @ApiProperty()
  bankAccountProfileId: string;

  @ApiPropertyOptional({ nullable: true })
  bankAccountProfileSnapshot: TransactionReferenceSnapshotValue;

  @ApiProperty()
  productId: string;

  @ApiPropertyOptional({ nullable: true })
  productSnapshot: TransactionReferenceSnapshotValue;

  @ApiProperty({ enum: ClientType })
  partyProfileType: ClientType;

  @ApiProperty()
  partyProfileId: string;

  @ApiPropertyOptional({ nullable: true })
  partyProfileSnapshot: TransactionReferenceSnapshotValue;

  @ApiPropertyOptional({ nullable: true })
  marketingExecutiveId: string | null;

  @ApiPropertyOptional({ nullable: true })
  marketingExecutiveSnapshot: TransactionReferenceSnapshotValue;

  @ApiPropertyOptional({ nullable: true })
  passengerId: string | null;

  @ApiPropertyOptional({ nullable: true })
  passengerName: string | null;

  @ApiPropertyOptional({ nullable: true })
  passengerPan: string | null;

  @ApiPropertyOptional({ nullable: true })
  passengerPanHolder: string | null;

  @ApiPropertyOptional({ nullable: true })
  passengerPanDob: string | null;

  @ApiPropertyOptional({ nullable: true })
  passengerPassport: string | null;

  @ApiProperty()
  purposeId: string;

  @ApiPropertyOptional({ nullable: true })
  purposeSnapshot: TransactionReferenceSnapshotValue;

  @ApiPropertyOptional({ nullable: true })
  subpurposeId: string | null;

  @ApiPropertyOptional({ nullable: true })
  subpurposeSnapshot: TransactionReferenceSnapshotValue;

  @ApiProperty()
  currencyId: string;

  @ApiPropertyOptional({ nullable: true })
  currencySnapshot: TransactionReferenceSnapshotValue;

  @ApiProperty()
  issuerPartyProfileId: string;

  @ApiPropertyOptional({ nullable: true })
  issuerPartyProfileSnapshot: TransactionReferenceSnapshotValue;

  @ApiProperty()
  feAmount: string;

  @ApiProperty()
  dealRate: string;

  @ApiProperty()
  dealRateSnapshot: Record<string, unknown>;

  @ApiProperty()
  inrAmount: string;

  @ApiProperty()
  fbChargeAmount: string;

  @ApiPropertyOptional({ nullable: true })
  narration: string | null;

  @ApiProperty()
  maturityOptionId: string;

  @ApiProperty({ enum: DealCoverStatus })
  status: DealCoverStatus;

  @ApiProperty()
  transactionNumber: string;

  @ApiPropertyOptional({ nullable: true })
  dealNo: string | null;

  @ApiPropertyOptional({ nullable: true })
  bookingRate: string | null;

  @ApiPropertyOptional({ nullable: true })
  rejectionReason: string | null;

  @ApiPropertyOptional({ nullable: true })
  cancelledAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  cancelledById: string | null;

  @ApiPropertyOptional({ nullable: true })
  consumedTransactionItemId: string | null;

  @ApiPropertyOptional({ nullable: true })
  consumedTransactionId: string | null;

  @ApiPropertyOptional({ nullable: true })
  approvedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  approvedById: string | null;

  @ApiPropertyOptional({ nullable: true })
  rejectedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  rejectedById: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  createdBy?: string;

  @ApiPropertyOptional()
  updatedBy?: string;

  static fromEntity(entity: DealCover): DealCoverResponseDto {
    const dto = new DealCoverResponseDto();
    dto.id = entity.id;
    dto.branchId = entity.branchId;
    dto.branchSnapshot = entity.branchSnapshot;
    dto.transactionDate = entity.transactionDate;
    dto.bankAccountProfileId = entity.bankAccountProfileId;
    dto.bankAccountProfileSnapshot = entity.bankAccountProfileSnapshot;
    dto.productId = entity.productId;
    dto.productSnapshot = entity.productSnapshot;
    dto.partyProfileType = entity.partyProfileType;
    dto.partyProfileId = entity.partyProfileId;
    dto.partyProfileSnapshot = entity.partyProfileSnapshot;
    dto.marketingExecutiveId = entity.marketingExecutiveId;
    dto.marketingExecutiveSnapshot = entity.marketingExecutiveSnapshot;
    dto.passengerId = entity.passengerId;
    dto.passengerName = entity.passengerName;
    dto.passengerPan = entity.passengerPan;
    dto.passengerPanHolder = entity.passengerPanHolder;
    dto.passengerPanDob = entity.passengerPanDob;
    dto.passengerPassport = entity.passengerPassport;
    dto.purposeId = entity.purposeId;
    dto.purposeSnapshot = entity.purposeSnapshot;
    dto.subpurposeId = entity.subpurposeId;
    dto.subpurposeSnapshot = entity.subpurposeSnapshot;
    dto.currencyId = entity.currencyId;
    dto.currencySnapshot = entity.currencySnapshot;
    dto.issuerPartyProfileId = entity.issuerPartyProfileId;
    dto.issuerPartyProfileSnapshot = entity.issuerPartyProfileSnapshot;
    dto.feAmount = entity.feAmount;
    dto.dealRate = entity.dealRate;
    dto.dealRateSnapshot = entity.dealRateSnapshot;
    dto.inrAmount = entity.inrAmount;
    dto.fbChargeAmount = entity.fbChargeAmount;
    dto.narration = entity.narration;
    dto.maturityOptionId = entity.maturityOptionId;
    dto.status = entity.status;
    dto.transactionNumber = entity.transactionNumber;
    dto.dealNo = entity.dealNo;
    dto.bookingRate = entity.bookingRate;
    dto.rejectionReason = entity.rejectionReason;
    dto.cancelledAt = entity.cancelledAt;
    dto.cancelledById = entity.cancelledById;
    dto.consumedTransactionItemId = entity.consumedTransactionItemId;
    dto.consumedTransactionId = entity.consumedTransactionId;
    dto.approvedAt = entity.approvedAt;
    dto.approvedById = entity.approvedById;
    dto.rejectedAt = entity.rejectedAt;
    dto.rejectedById = entity.rejectedById;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    dto.createdBy = entity.createdBy;
    dto.updatedBy = entity.updatedBy;
    return dto;
  }
}

export class DealCoverCurrencyAggregateDto {
  @ApiProperty()
  currencyId: string;

  @ApiPropertyOptional({ nullable: true })
  currencySnapshot: TransactionReferenceSnapshotValue;

  @ApiProperty()
  totalFeAmount: string;

  @ApiProperty()
  weightedAvgDealRate: string;

  @ApiProperty()
  totalInrAmount: string;

  @ApiProperty()
  dealCount: number;

  @ApiProperty({ type: [DealCoverResponseDto] })
  deals: DealCoverResponseDto[];
}

export class DealCoverAckListResponseDto {
  @ApiProperty({ type: [DealCoverCurrencyAggregateDto] })
  groups: DealCoverCurrencyAggregateDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  offset: number;
}
