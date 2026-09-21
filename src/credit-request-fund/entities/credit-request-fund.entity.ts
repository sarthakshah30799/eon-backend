import { Check, Column, Entity, Index, OneToMany } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { TransactionReferenceSnapshotValue } from "../../transactions/types/transaction-snapshot.types";
import { TransactionPaymentMethod } from "../../transactions/transactions.enums";
import { VoucherAccountMode } from "../../vouchers/voucher.enums";
import { CreditRequestFundStatus } from "../credit-request-fund.enums";
import { CreditRequestFundItem } from "./credit-request-fund-item.entity";

@Entity("credit_request_funds")
@Index("IDX_credit_request_funds_number", ["number"], { unique: true })
@Index("IDX_credit_request_funds_idempotency", ["idempotencyKey"], {
  unique: true,
})
@Index("IDX_credit_request_funds_status_date", ["status", "transactionDate"])
@Index("IDX_credit_request_funds_branch", ["branchId"])
@Index("IDX_credit_request_funds_destination_branch", ["destinationBranchId"])
@Index("IDX_credit_request_funds_party", ["partyProfileId"])
@Check(
  "CHK_credit_request_funds_amounts_nonnegative",
  `"total_debit" >= 0 AND "total_credit" >= 0 AND "final_amount" >= 0`,
)
export class CreditRequestFund extends BaseEntity {
  @Column({ type: "citext" }) number: string;
  @Column({ type: "text", name: "number_series_code" })
  numberSeriesCode: string;
  @Column({ type: "text", name: "idempotency_key" }) idempotencyKey: string;
  @Column({ type: "text", name: "payload_hash" }) payloadHash: string;

  @Column({
    type: "enum",
    enum: CreditRequestFundStatus,
    default: CreditRequestFundStatus.PENDING,
  })
  status: CreditRequestFundStatus;

  @Column({ type: "date", name: "transaction_date" }) transactionDate: string;
  @Column({ type: "uuid", name: "branch_id" }) branchId: string;
  @Column({ type: "jsonb", name: "branch_snapshot" })
  branchSnapshot: TransactionReferenceSnapshotValue;
  @Column({ type: "uuid", name: "counter_id" }) counterId: string;
  @Column({ type: "jsonb", name: "counter_snapshot" })
  counterSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "destination_branch_id" })
  destinationBranchId: string;
  @Column({ type: "jsonb", name: "destination_branch_snapshot" })
  destinationBranchSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "account_type_option_id" })
  accountTypeOptionId: string;
  @Column({ type: "jsonb", name: "account_type_snapshot" })
  accountTypeSnapshot: TransactionReferenceSnapshotValue;
  @Column({ type: "enum", enum: VoucherAccountMode, name: "account_mode" })
  accountMode: VoucherAccountMode;
  @Column({ type: "uuid", name: "header_account_id" }) headerAccountId: string;
  @Column({ type: "jsonb", name: "header_account_snapshot" })
  headerAccountSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "entity_type_option_id" })
  entityTypeOptionId: string;
  @Column({ type: "jsonb", name: "entity_type_snapshot" })
  entityTypeSnapshot: TransactionReferenceSnapshotValue;
  @Column({ type: "uuid", name: "party_profile_id" }) partyProfileId: string;
  @Column({ type: "jsonb", name: "party_profile_snapshot" })
  partyProfileSnapshot: TransactionReferenceSnapshotValue;

  @Column({
    type: "enum",
    enum: TransactionPaymentMethod,
    name: "payment_method",
    nullable: true,
  })
  paymentMethod: TransactionPaymentMethod | null;
  @Column({ type: "citext", name: "cheque_number", nullable: true })
  chequeNumber: string | null;
  @Column({ type: "citext", name: "normalized_cheque_number", nullable: true })
  normalizedChequeNumber: string | null;
  @Column({ type: "date", name: "cheque_date", nullable: true })
  chequeDate: string | null;
  @Column({ type: "text", name: "cheque_branch", nullable: true })
  chequeBranch: string | null;
  @Column({ type: "text", name: "drawn_on", nullable: true })
  drawnOn: string | null;

  @Column({ type: "uuid", name: "remark_option_id", nullable: true })
  remarkOptionId: string | null;
  @Column({ type: "jsonb", name: "remark_snapshot", nullable: true })
  remarkSnapshot: TransactionReferenceSnapshotValue | null;
  @Column({ type: "text" }) narration: string;

  @Column({ type: "citext", name: "paid_by_pan_number", nullable: true })
  paidByPanNumber: string | null;
  @Column({ type: "citext", name: "paid_by_pan_name", nullable: true })
  paidByPanName: string | null;
  @Column({ type: "date", name: "paid_by_pan_dob", nullable: true })
  paidByPanDob: string | null;
  @Column({ type: "uuid", name: "pan_holder_relation_option_id", nullable: true })
  panHolderRelationOptionId: string | null;
  @Column({
    type: "jsonb",
    name: "pan_holder_relation_snapshot",
    nullable: true,
  })
  panHolderRelationSnapshot: TransactionReferenceSnapshotValue | null;
  @Column({ type: "citext", name: "traveler_pan_number", nullable: true })
  travelerPanNumber: string | null;
  @Column({ type: "citext", name: "traveler_pan_name", nullable: true })
  travelerPanName: string | null;
  @Column({ type: "date", name: "traveler_pan_dob", nullable: true })
  travelerPanDob: string | null;

  @Column({ type: "numeric", precision: 18, scale: 2, name: "total_debit" })
  totalDebit: string;
  @Column({ type: "numeric", precision: 18, scale: 2, name: "total_credit" })
  totalCredit: string;
  @Column({ type: "numeric", precision: 18, scale: 2, name: "final_amount" })
  finalAmount: string;

  @Column({ type: "uuid", name: "approved_by", nullable: true })
  approvedBy: string | null;
  @Column({ type: "timestamptz", name: "approved_at", nullable: true })
  approvedAt: Date | null;
  @Column({ type: "date", name: "approved_transaction_date", nullable: true })
  approvedTransactionDate: string | null;
  @Column({ type: "uuid", name: "rejected_by", nullable: true })
  rejectedBy: string | null;
  @Column({ type: "timestamptz", name: "rejected_at", nullable: true })
  rejectedAt: Date | null;
  @Column({ type: "text", name: "rejection_remarks", nullable: true })
  rejectionRemarks: string | null;
  @Column({ type: "uuid", name: "cancelled_by", nullable: true })
  cancelledBy: string | null;
  @Column({ type: "timestamptz", name: "cancelled_at", nullable: true })
  cancelledAt: Date | null;

  @Column({ type: "uuid", name: "destination_receipt_voucher_id", nullable: true })
  destinationReceiptVoucherId: string | null;
  @Column({
    type: "jsonb",
    name: "destination_receipt_voucher_snapshot",
    nullable: true,
  })
  destinationReceiptVoucherSnapshot: TransactionReferenceSnapshotValue | null;
  @Column({ type: "uuid", name: "requesting_receipt_voucher_id", nullable: true })
  requestingReceiptVoucherId: string | null;
  @Column({
    type: "jsonb",
    name: "requesting_receipt_voucher_snapshot",
    nullable: true,
  })
  requestingReceiptVoucherSnapshot: TransactionReferenceSnapshotValue | null;
  @Column({ type: "uuid", name: "requesting_payment_voucher_id", nullable: true })
  requestingPaymentVoucherId: string | null;
  @Column({
    type: "jsonb",
    name: "requesting_payment_voucher_snapshot",
    nullable: true,
  })
  requestingPaymentVoucherSnapshot: TransactionReferenceSnapshotValue | null;

  @OneToMany(() => CreditRequestFundItem, (item) => item.creditRequestFund, {
    cascade: false,
  })
  items: CreditRequestFundItem[];
}
