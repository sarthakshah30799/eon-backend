import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { Transaction } from "./transaction.entity";
import { TransactionReferenceSnapshotValue } from "../types/transaction-snapshot.types";
import { TransactionTaxSplitMode } from "../transactions.enums";

@Index("IDX_transaction_additional_charges_transaction_id", ["transactionId"])
@Index(
  "IDX_transaction_additional_charges_transaction_line",
  ["transactionId", "lineNo"],
  { unique: true },
)
@Entity("transaction_additional_charges")
export class TransactionAdditionalCharge extends BaseEntity {
  @Column({ type: "uuid", name: "transaction_id" })
  transactionId: string;

  @ManyToOne(
    () => Transaction,
    (transaction) => transaction.additionalCharges,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({
    name: "transaction_id",
    foreignKeyConstraintName: "FK_transaction_additional_charges_transaction_id",
  })
  transaction: Transaction;

  @Column({ type: "integer", name: "line_no" })
  lineNo: number;

  @Column({ type: "uuid", name: "account_id" })
  accountId: string;

  @Column({ type: "jsonb", name: "account_snapshot", nullable: true })
  accountSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "numeric", precision: 18, scale: 4 })
  amount: string;

  @Column({ type: "numeric", name: "gst_rate", precision: 18, scale: 4, nullable: true })
  gstRate: string | null;

  @Column({
    type: "numeric",
    name: "gst_amount",
    precision: 18,
    scale: 4,
    nullable: true,
  })
  gstAmount: string | null;

  @Column({
    type: "numeric",
    name: "tax_rate_percent",
    precision: 18,
    scale: 4,
    default: 0,
  })
  taxRatePercent: string;

  @Column({
    type: "numeric",
    name: "igst_rate_percent",
    precision: 18,
    scale: 4,
    default: 0,
  })
  igstRatePercent: string;

  @Column({
    type: "numeric",
    name: "cgst_rate_percent",
    precision: 18,
    scale: 4,
    default: 0,
  })
  cgstRatePercent: string;

  @Column({
    type: "numeric",
    name: "sgst_rate_percent",
    precision: 18,
    scale: 4,
    default: 0,
  })
  sgstRatePercent: string;

  @Column({
    type: "numeric",
    name: "igst_amount",
    precision: 18,
    scale: 4,
    default: 0,
  })
  igstAmount: string;

  @Column({
    type: "numeric",
    name: "cgst_amount",
    precision: 18,
    scale: 4,
    default: 0,
  })
  cgstAmount: string;

  @Column({
    type: "numeric",
    name: "sgst_amount",
    precision: 18,
    scale: 4,
    default: 0,
  })
  sgstAmount: string;

  @Column({
    type: "enum",
    enum: TransactionTaxSplitMode,
    name: "split_mode",
    nullable: true,
  })
  splitMode: TransactionTaxSplitMode | null;

  @Column({ type: "text", nullable: true })
  remarks: string | null;
}
