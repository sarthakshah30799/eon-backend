import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { Transaction } from "./transaction.entity";
import { TransactionEventStatus } from "../transactions.enums";

@Index("IDX_transaction_events_transaction_id", ["transactionId"])
@Index("IDX_transaction_events_status_available_at", ["status", "availableAt"])
@Entity("transaction_events")
export class TransactionEvent extends BaseEntity {
  @Column({ type: "uuid", name: "transaction_id" })
  transactionId: string;

  @ManyToOne(() => Transaction, (transaction) => transaction.events, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "transaction_id",
    foreignKeyConstraintName: "FK_transaction_events_transaction_id",
  })
  transaction: Transaction;

  @Column({ type: "varchar", length: 150, name: "event_type" })
  eventType: string;

  @Column({ type: "jsonb", nullable: false })
  payload: Record<string, unknown>;

  @Column({
    type: "enum",
    enum: TransactionEventStatus,
    default: TransactionEventStatus.PENDING,
  })
  status: TransactionEventStatus;

  @Column({ type: "integer", name: "attempt_count", default: 0 })
  attemptCount: number;

  @Column({ type: "timestamptz", name: "available_at", default: () => "now()" })
  availableAt: Date;

  @Column({ type: "timestamptz", name: "processed_at", nullable: true })
  processedAt: Date | null;

  @Column({ type: "text", name: "error_message", nullable: true })
  errorMessage: string | null;

  @Column({ type: "timestamptz", name: "locked_at", nullable: true })
  lockedAt: Date | null;

  @Column({ type: "uuid", name: "locked_by_id", nullable: true })
  lockedById: string | null;
}
