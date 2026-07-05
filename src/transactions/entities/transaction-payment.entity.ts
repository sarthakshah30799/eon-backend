import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { Transaction } from "./transaction.entity";
import {
  TransactionPaymentMethod,
} from "../transactions.enums";
import { TransactionReferenceSnapshotValue } from "../types/transaction-snapshot.types";

@Index("IDX_transaction_payments_transaction_id", ["transactionId"])
@Index("IDX_transaction_payments_transaction_line", ["transactionId", "lineNo"], {
  unique: true,
})
@Entity("transaction_payments")
export class TransactionPayment extends BaseEntity {
  @Column({ type: "uuid", name: "transaction_id" })
  transactionId: string;

  @ManyToOne(() => Transaction, (transaction) => transaction.payments, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "transaction_id",
    foreignKeyConstraintName: "FK_transaction_payments_transaction_id",
  })
  transaction: Transaction;

  @Column({ type: "integer", name: "line_no" })
  lineNo: number;

  @Column({ type: "uuid", name: "account_id" })
  accountId: string;

  @Column({ type: "jsonb", name: "account_snapshot", nullable: true })
  accountSnapshot: TransactionReferenceSnapshotValue;

  @Column({
    type: "enum",
    enum: TransactionPaymentMethod,
    enumName: "transaction_payments_method_enum",
    default: TransactionPaymentMethod.OTHER,
  })
  paymentMethod: TransactionPaymentMethod;

  @Column({
    type: "varchar",
    length: 100,
    name: "reference_number",
    nullable: true,
  })
  referenceNumber: string | null;

  @Column({ type: "date", name: "reference_date", nullable: true })
  referenceDate: string | null;

  @Column({ type: "varchar", length: 255, name: "branch_name", nullable: true })
  branchName: string | null;

  @Column({ type: "numeric", precision: 18, scale: 4 })
  amount: string;

  @Column({ type: "text", nullable: true })
  remarks: string | null;
}
