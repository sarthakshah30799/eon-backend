import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { ClientType } from "../../party-profiles/party-profile.entity";
import { TransactionReferenceSnapshotValue } from "../../transactions/types/transaction-snapshot.types";
import { DealCoverStatus } from "../deal-cover.enums";

@Index("IDX_deal_covers_status", ["status"])
@Index("IDX_deal_covers_branch", ["branchId"])
@Index("IDX_deal_covers_transaction_date", ["transactionDate"])
@Index("IDX_deal_covers_currency", ["currencyId"])
@Index("IDX_deal_covers_product", ["productId"])
@Index("IDX_deal_covers_issuer", ["issuerPartyProfileId"])
@Index("IDX_deal_covers_transaction_number", ["transactionNumber"])
@Index("IDX_deal_covers_deal_no", ["dealNo"])
@Index("UQ_deal_covers_consumed_item", ["consumedTransactionItemId"], {
  unique: true,
})
@Entity("deal_covers")
export class DealCover extends BaseEntity {
  @Column({ type: "uuid", name: "branch_id" })
  branchId: string;

  @Column({ type: "jsonb", name: "branch_snapshot" })
  branchSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "timestamptz", name: "transaction_date" })
  transactionDate: Date;

  @Column({ type: "uuid", name: "bank_account_profile_id" })
  bankAccountProfileId: string;

  @Column({ type: "jsonb", name: "bank_account_profile_snapshot" })
  bankAccountProfileSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "product_id" })
  productId: string;

  @Column({ type: "jsonb", name: "product_snapshot" })
  productSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "citext", name: "party_profile_type" })
  partyProfileType: ClientType;

  @Column({ type: "uuid", name: "party_profile_id" })
  partyProfileId: string;

  @Column({ type: "jsonb", name: "party_profile_snapshot" })
  partyProfileSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "marketing_executive_id", nullable: true })
  marketingExecutiveId: string | null;

  @Column({ type: "jsonb", name: "marketing_executive_snapshot", nullable: true })
  marketingExecutiveSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "passenger_id", nullable: true })
  passengerId: string | null;

  @Column({ type: "citext", name: "passenger_name", nullable: true })
  passengerName: string | null;

  @Column({ type: "citext", name: "passenger_pan", nullable: true })
  passengerPan: string | null;

  @Column({ type: "citext", name: "passenger_pan_holder", nullable: true })
  passengerPanHolder: string | null;

  @Column({ type: "date", name: "passenger_pan_dob", nullable: true })
  passengerPanDob: string | null;

  @Column({ type: "citext", name: "passenger_passport", nullable: true })
  passengerPassport: string | null;

  @Column({ type: "uuid", name: "purpose_id" })
  purposeId: string;

  @Column({ type: "jsonb", name: "purpose_snapshot" })
  purposeSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "subpurpose_id", nullable: true })
  subpurposeId: string | null;

  @Column({ type: "jsonb", name: "subpurpose_snapshot", nullable: true })
  subpurposeSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "currency_id" })
  currencyId: string;

  @Column({ type: "jsonb", name: "currency_snapshot" })
  currencySnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "issuer_party_profile_id" })
  issuerPartyProfileId: string;

  @Column({ type: "jsonb", name: "issuer_party_profile_snapshot" })
  issuerPartyProfileSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "numeric", precision: 18, scale: 2, name: "fe_amount" })
  feAmount: string;

  @Column({ type: "numeric", precision: 18, scale: 7, name: "deal_rate" })
  dealRate: string;

  @Column({ type: "jsonb", name: "deal_rate_snapshot" })
  dealRateSnapshot: Record<string, unknown>;

  @Column({ type: "numeric", precision: 18, scale: 2, name: "inr_amount" })
  inrAmount: string;

  @Column({
    type: "numeric",
    precision: 18,
    scale: 2,
    name: "fb_charge_amount",
    default: 0,
  })
  fbChargeAmount: string;

  @Column({ type: "text", nullable: true })
  narration: string | null;

  @Column({ type: "uuid", name: "maturity_option_id" })
  maturityOptionId: string;

  @Column({
    type: "enum",
    enum: DealCoverStatus,
    enumName: "deal_covers_status_enum",
    name: "status",
    default: DealCoverStatus.PENDING,
  })
  status: DealCoverStatus;

  @Column({ type: "citext", name: "transaction_number" })
  transactionNumber: string;

  @Column({ type: "citext", name: "deal_no", nullable: true })
  dealNo: string | null;

  @Column({
    type: "numeric",
    precision: 18,
    scale: 7,
    name: "booking_rate",
    nullable: true,
  })
  bookingRate: string | null;

  @Column({ type: "text", name: "rejection_reason", nullable: true })
  rejectionReason: string | null;

  @Column({ type: "timestamptz", name: "cancelled_at", nullable: true })
  cancelledAt: Date | null;

  @Column({ type: "uuid", name: "cancelled_by_id", nullable: true })
  cancelledById: string | null;

  @Column({
    type: "uuid",
    name: "consumed_transaction_item_id",
    nullable: true,
  })
  consumedTransactionItemId: string | null;

  @Column({ type: "uuid", name: "consumed_transaction_id", nullable: true })
  consumedTransactionId: string | null;

  @Column({ type: "timestamptz", name: "approved_at", nullable: true })
  approvedAt: Date | null;

  @Column({ type: "uuid", name: "approved_by_id", nullable: true })
  approvedById: string | null;

  @Column({ type: "timestamptz", name: "rejected_at", nullable: true })
  rejectedAt: Date | null;

  @Column({ type: "uuid", name: "rejected_by_id", nullable: true })
  rejectedById: string | null;
}
