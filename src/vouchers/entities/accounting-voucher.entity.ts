import { Check, Column, Entity, Index, OneToMany } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { TransactionReferenceSnapshotValue } from "../../transactions/types/transaction-snapshot.types";
import { VoucherAccountMode, VoucherType } from "../voucher.enums";
import { AccountingVoucherItem } from "./accounting-voucher-item.entity";
import { VoucherAdvanceApplication } from "./voucher-advance-application.entity";

@Entity("accounting_vouchers")
@Index("IDX_accounting_vouchers_number", ["number"], { unique: true })
@Index("IDX_accounting_vouchers_idempotency", ["idempotencyKey"], { unique: true })
@Index("IDX_accounting_vouchers_party_branch_date", ["partyProfileId", "branchId", "transactionDate"])
@Index("IDX_accounting_vouchers_type_date", ["voucherType", "transactionDate"])
@Index("UQ_accounting_vouchers_cheque", ["voucherType", "headerAccountId", "normalizedChequeNumber"], { unique: true, where: `"normalized_cheque_number" IS NOT NULL` })
@Check("CHK_accounting_vouchers_amounts_nonnegative", `"total_debit" >= 0 AND "total_credit" >= 0 AND "final_amount" >= 0`)
export class AccountingVoucher extends BaseEntity {
  @Column({ type: "enum", enum: VoucherType, name: "voucher_type" }) voucherType: VoucherType;
  @Column({ type: "citext" }) number: string;
  @Column({ type: "text", name: "idempotency_key" }) idempotencyKey: string;
  @Column({ type: "text", name: "payload_hash" }) payloadHash: string;
  @Column({ type: "date", name: "transaction_date" }) transactionDate: string;
  @Column({ type: "uuid", name: "branch_id" }) branchId: string;
  @Column({ type: "jsonb", name: "branch_snapshot" }) branchSnapshot: TransactionReferenceSnapshotValue;
  @Column({ type: "uuid", name: "counter_id" }) counterId: string;
  @Column({ type: "jsonb", name: "counter_snapshot" }) counterSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "account_type_option_id", nullable: true }) accountTypeOptionId: string | null;
  @Column({ type: "jsonb", name: "account_type_snapshot", nullable: true }) accountTypeSnapshot: TransactionReferenceSnapshotValue;
  @Column({ type: "enum", enum: VoucherAccountMode, name: "account_mode", nullable: true }) accountMode: VoucherAccountMode | null;
  @Column({ type: "uuid", name: "header_account_id", nullable: true }) headerAccountId: string | null;
  @Column({ type: "jsonb", name: "header_account_snapshot", nullable: true }) headerAccountSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "entity_type_option_id", nullable: true }) entityTypeOptionId: string | null;
  @Column({ type: "jsonb", name: "entity_type_snapshot", nullable: true }) entityTypeSnapshot: TransactionReferenceSnapshotValue;
  @Column({ type: "uuid", name: "party_profile_id", nullable: true }) partyProfileId: string | null;
  @Column({ type: "jsonb", name: "party_profile_snapshot", nullable: true }) partyProfileSnapshot: TransactionReferenceSnapshotValue;
  @Column({ type: "citext", name: "pan_number", nullable: true }) panNumber: string | null;

  @Column({ type: "citext", name: "cheque_number", nullable: true }) chequeNumber: string | null;
  @Column({ type: "citext", name: "normalized_cheque_number", nullable: true }) normalizedChequeNumber: string | null;
  @Column({ type: "date", name: "cheque_date", nullable: true }) chequeDate: string | null;
  @Column({ type: "text", name: "cheque_branch", nullable: true }) chequeBranch: string | null;
  @Column({ type: "text", name: "drawn_on", nullable: true }) drawnOn: string | null;

  @Column({ type: "uuid", name: "remark_option_id", nullable: true }) remarkOptionId: string | null;
  @Column({ type: "jsonb", name: "remark_snapshot", nullable: true }) remarkSnapshot: TransactionReferenceSnapshotValue;
  @Column({ type: "text" }) narration: string;
  @Column({ type: "numeric", precision: 18, scale: 2, name: "total_debit" }) totalDebit: string;
  @Column({ type: "numeric", precision: 18, scale: 2, name: "total_credit" }) totalCredit: string;
  @Column({ type: "numeric", precision: 18, scale: 2, name: "final_amount" }) finalAmount: string;
  @Column({ type: "uuid", name: "advance_control_account_id", nullable: true }) advanceControlAccountId: string | null;
  @Column({ type: "jsonb", name: "advance_control_account_snapshot", nullable: true }) advanceControlAccountSnapshot: TransactionReferenceSnapshotValue;

  @OneToMany(() => AccountingVoucherItem, item => item.voucher) items: AccountingVoucherItem[];
  @OneToMany(() => VoucherAdvanceApplication, application => application.voucher) applications: VoucherAdvanceApplication[];
}
