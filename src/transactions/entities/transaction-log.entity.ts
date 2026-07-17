import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { Transaction } from "./transaction.entity";
import { TransactionLogAction } from "../transactions.enums";

@Index("IDX_transaction_logs_transaction_id", ["transactionId"])
@Entity("transaction_logs")
export class TransactionLog extends BaseEntity {
  @Column({ type: "uuid", name: "transaction_id" })
  transactionId: string;

  @ManyToOne(() => Transaction, (transaction) => transaction.logs, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "transaction_id",
    foreignKeyConstraintName: "FK_transaction_logs_transaction_id",
  })
  transaction: Transaction;

  @Column({
    type: "enum",
    enum: TransactionLogAction,
  })
  action: TransactionLogAction;

  @Column({ type: "text" })
  message: string;

  @Column({ type: "jsonb", name: "before_snapshot", nullable: true })
  beforeSnapshot: Record<string, unknown> | null;

  @Column({ type: "jsonb", name: "after_snapshot", nullable: true })
  afterSnapshot: Record<string, unknown> | null;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: "uuid", name: "performed_by_id", nullable: true })
  performedById: string | null;

  @Column({ type: "timestamptz", name: "performed_at", default: () => "now()" })
  performedAt: Date;
}
