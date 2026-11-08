import {
  Column,
  Entity,
  Index,
  OneToMany,
} from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import {
  AdvanceRefundPayoutSource,
  AdvanceRefundStatus,
  AdvanceRefundType,
} from "../advance-refund.enums";
import { AdvanceRefundItem } from "./advance-refund-item.entity";
import { AdvanceRefundPrintLog } from "./advance-refund-print-log.entity";

@Entity("advance_refund")
@Index("UQ_advance_refund_number", ["number"], { unique: true })
@Index("IDX_advance_refund_branch_date", ["branchId", "transactionDate"])
@Index("IDX_advance_refund_party", ["partyProfileId"])
@Index("IDX_advance_refund_status", ["status"])
export class AdvanceRefund extends BaseEntity {
  @Column({ type: "citext" })
  number: string;

  @Column({ type: "uuid", name: "branch_id" })
  branchId: string;

  @Column({ type: "jsonb", name: "branch_snapshot" })
  branchSnapshot: Record<string, any>;

  @Column({ type: "uuid", name: "counter_id" })
  counterId: string;

  @Column({ type: "jsonb", name: "counter_snapshot" })
  counterSnapshot: Record<string, any>;

  @Column({ type: "date", name: "transaction_date" })
  transactionDate: string;

  @Column({ type: "date", name: "as_on_date" })
  asOnDate: string;

  @Column({ type: "uuid", name: "party_profile_id" })
  partyProfileId: string;

  @Column({ type: "jsonb", name: "party_profile_snapshot" })
  partyProfileSnapshot: Record<string, any>;

  @Column({ type: "citext", nullable: true, name: "pan_number" })
  panNumber: string | null;

  @Column({ type: "citext", nullable: true, name: "pan_name" })
  panName: string | null;

  @Column({ type: "date", nullable: true, name: "pan_dob" })
  panDob: string | null;

  @Column({ type: "enum", enum: AdvanceRefundType, name: "refund_type" })
  refundType: AdvanceRefundType;

  @Column({
    type: "enum",
    enum: AdvanceRefundStatus,
    default: AdvanceRefundStatus.DRAFT,
  })
  status: AdvanceRefundStatus;

  @Column({
    type: "numeric",
    precision: 18,
    scale: 2,
    name: "total_refund_amount",
  })
  totalRefundAmount: string;

  @Column({ type: "text" })
  narration: string;

  @Column({ type: "uuid", nullable: true, name: "remark_option_id" })
  remarkOptionId: string | null;

  @Column({ type: "jsonb", nullable: true, name: "remark_snapshot" })
  remarkSnapshot: Record<string, any> | null;

  // Knock Off fields
  @Column({ type: "uuid", nullable: true, name: "knock_off_account_id" })
  knockOffAccountId: string | null;

  @Column({ type: "jsonb", nullable: true, name: "knock_off_account_snapshot" })
  knockOffAccountSnapshot: Record<string, any> | null;

  // Refund fields
  @Column({
    type: "enum",
    enum: AdvanceRefundPayoutSource,
    nullable: true,
    name: "payout_source",
  })
  payoutSource: AdvanceRefundPayoutSource | null;

  @Column({ type: "uuid", nullable: true, name: "paying_bank_account_id" })
  payingBankAccountId: string | null;

  @Column({
    type: "jsonb",
    nullable: true,
    name: "paying_bank_account_snapshot",
  })
  payingBankAccountSnapshot: Record<string, any> | null;

  @Column({ type: "citext", nullable: true, name: "payment_method" })
  paymentMethod: string | null;

  @Column({ type: "citext", nullable: true, name: "beneficiary_account_number" })
  beneficiaryAccountNumber: string | null;

  @Column({ type: "citext", nullable: true, name: "beneficiary_ifsc_code" })
  beneficiaryIfscCode: string | null;

  @Column({ type: "citext", nullable: true, name: "beneficiary_name" })
  beneficiaryName: string | null;

  @Column({ type: "citext", nullable: true, name: "bank_name" })
  bankName: string | null;

  @Column({ type: "citext", nullable: true, name: "cheque_number" })
  chequeNumber: string | null;

  @Column({ type: "date", nullable: true, name: "cheque_date" })
  chequeDate: string | null;

  @Column({ type: "citext", nullable: true, name: "drawn_on" })
  drawnOn: string | null;

  // Linked Accounting Vouchers
  @Column({ type: "uuid", nullable: true, name: "journal_voucher_id" })
  journalVoucherId: string | null;

  @Column({ type: "uuid", nullable: true, name: "payment_voucher_id" })
  paymentVoucherId: string | null;

  @Column({ type: "uuid", nullable: true, name: "advice_voucher_id" })
  adviceVoucherId: string | null;

  @Column({ type: "uuid", nullable: true, name: "ho_payment_voucher_id" })
  hoPaymentVoucherId: string | null;

  @Column({ type: "integer", name: "print_count", default: 0 })
  printCount: number;

  @OneToMany(() => AdvanceRefundItem, (item) => item.advanceRefund, {
    cascade: true,
  })
  items: AdvanceRefundItem[];

  @OneToMany(() => AdvanceRefundPrintLog, (log) => log.advanceRefund)
  printLogs: AdvanceRefundPrintLog[];
}
