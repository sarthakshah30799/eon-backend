import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { Transaction } from "./transaction.entity";
import { TransactionTaxSplitMode } from "../transactions.enums";

// DB-managed summary table refreshed by transaction tax triggers/functions.
// This entity exists so the tax summary record is visible to developers and tooling.
@Entity("transaction_tax_summaries")
export class TransactionTaxSummary {
  @PrimaryColumn({ type: "uuid", name: "transaction_id" })
  transactionId: string;

  @ManyToOne(() => Transaction, { onDelete: "CASCADE" })
  @JoinColumn({
    name: "transaction_id",
    foreignKeyConstraintName: "FK_transaction_tax_summaries_transaction_id",
  })
  transaction: Transaction;

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
    name: "taxable_amount",
    precision: 18,
    scale: 2,
    default: 0,
  })
  taxableAmount: string;

  @Column({
    type: "numeric",
    name: "item_base_amount",
    precision: 18,
    scale: 2,
    default: 0,
  })
  itemBaseAmount: string;

  @Column({
    type: "numeric",
    name: "item_tax_amount",
    precision: 18,
    scale: 2,
    default: 0,
  })
  itemTaxAmount: string;

  @Column({
    type: "numeric",
    name: "additional_charge_base_amount",
    precision: 18,
    scale: 2,
    default: 0,
  })
  additionalChargeBaseAmount: string;

  @Column({
    type: "numeric",
    name: "additional_charge_tax_amount",
    precision: 18,
    scale: 2,
    default: 0,
  })
  additionalChargeTaxAmount: string;

  @Column({
    type: "numeric",
    name: "igst_amount",
    precision: 18,
    scale: 2,
    default: 0,
  })
  igstAmount: string;

  @Column({
    type: "numeric",
    name: "cgst_amount",
    precision: 18,
    scale: 2,
    default: 0,
  })
  cgstAmount: string;

  @Column({
    type: "numeric",
    name: "sgst_amount",
    precision: 18,
    scale: 2,
    default: 0,
  })
  sgstAmount: string;

  @Column({
    type: "numeric",
    name: "final_amount",
    precision: 18,
    scale: 2,
    default: 0,
  })
  finalAmount: string;

  @Column({
    type: "enum",
    enum: TransactionTaxSplitMode,
    name: "split_mode",
    default: TransactionTaxSplitMode.CGST_SGST,
  })
  splitMode: TransactionTaxSplitMode;

  @Column({
    type: "timestamptz",
    name: "created_at",
    default: () => "now()",
  })
  createdAt: Date;

  @Column({
    type: "timestamptz",
    name: "updated_at",
    default: () => "now()",
  })
  updatedAt: Date;
}
