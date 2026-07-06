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

  @Column({ type: "text", nullable: true })
  remarks: string | null;
}
