import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { TransactionReferenceSnapshotValue } from "../../transactions/types/transaction-snapshot.types";
import {
  VoucherEntryDirection,
  VoucherPostingSourceType,
} from "../voucher.enums";
import { AccountingVoucher } from "./accounting-voucher.entity";

@Index("IDX_voucher_account_postings_voucher_id", ["voucherId"])
@Index(
  "IDX_voucher_account_postings_voucher_line",
  ["voucherId", "lineNo"],
  { unique: true },
)
@Index("IDX_voucher_account_postings_account_id", ["accountId"])
@Index("IDX_voucher_account_postings_profile_id", ["profileId"])
@Index("IDX_voucher_account_postings_transaction_id", ["transactionId"])
@Entity("voucher_account_postings")
export class VoucherAccountPosting extends BaseEntity {
  @Column({ type: "uuid", name: "voucher_id" })
  voucherId: string;

  @ManyToOne(() => AccountingVoucher, (voucher) => voucher.postings, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "voucher_id",
    foreignKeyConstraintName: "FK_voucher_account_postings_voucher_id",
  })
  voucher: AccountingVoucher;

  @Column({ type: "integer", name: "line_no" })
  lineNo: number;

  @Column({
    type: "enum",
    enum: VoucherPostingSourceType,
    name: "source_type",
  })
  sourceType: VoucherPostingSourceType;

  @Column({ type: "uuid", name: "source_id", nullable: true })
  sourceId: string | null;

  @Column({ type: "uuid", name: "transaction_id", nullable: true })
  transactionId: string | null;

  @Column({ type: "jsonb", name: "transaction_snapshot", nullable: true })
  transactionSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "account_id" })
  accountId: string;

  @Column({ type: "jsonb", name: "account_snapshot", nullable: true })
  accountSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "profile_id", nullable: true })
  profileId: string | null;

  @Column({ type: "jsonb", name: "profile_snapshot", nullable: true })
  profileSnapshot: TransactionReferenceSnapshotValue;

  @Column({
    type: "enum",
    enum: VoucherEntryDirection,
    name: "direction",
  })
  direction: VoucherEntryDirection;

  @Column({ type: "numeric", precision: 18, scale: 2 })
  amount: string;

  @Column({ type: "text", nullable: true })
  remarks: string | null;
}
