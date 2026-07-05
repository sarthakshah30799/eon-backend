import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import {
  TradeMode,
  TransactionStatus,
  TransactionType,
} from "../transactions.enums";
import { TransactionItem } from "./transaction-item.entity";
import { TransactionDocument } from "./transaction-document.entity";
import { TransactionAdditionalCharge } from "./transaction-additional-charge.entity";
import { TransactionPayment } from "./transaction-payment.entity";
import { TransactionLog } from "./transaction-log.entity";
import { TransactionEvent } from "./transaction-event.entity";
import {
  TransactionReferenceSnapshotValue,
} from "../types/transaction-snapshot.types";

@Index("IDX_transactions_number", ["number"])
@Index("IDX_transactions_root_transaction_id", ["rootTransactionId"])
@Index("IDX_transactions_branch_id", ["branchId"])
@Index("IDX_transactions_party_profile_id", ["partyProfileId"])
@Index("IDX_transactions_slug", ["slug"])
@Index("IDX_transactions_status", ["status"])
@Entity("transactions")
export class Transaction extends BaseEntity {
  @Column({ type: "uuid", name: "root_transaction_id", nullable: true })
  rootTransactionId: string | null;

  @ManyToOne(() => Transaction, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "root_transaction_id",
    foreignKeyConstraintName: "FK_transactions_root_transaction_id",
  })
  rootTransaction: Transaction | null;

  @Column({ type: "integer", name: "revision_no", default: 1 })
  revisionNo: number;

  @Column({ type: "varchar", length: 100, name: "number" })
  number: string;

  @Column({ type: "citext", nullable: true })
  slug: string | null;

  @Column({ type: "uuid", name: "branch_id" })
  branchId: string;

  @Column({ type: "jsonb", name: "branch_snapshot", nullable: true })
  branchSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "party_profile_id" })
  partyProfileId: string;

  @Column({ type: "jsonb", name: "party_profile_snapshot", nullable: true })
  partyProfileSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "agent_profile_id", nullable: true })
  agentProfileId: string | null;

  @Column({ type: "jsonb", name: "agent_profile_snapshot", nullable: true })
  agentProfileSnapshot: TransactionReferenceSnapshotValue;

  @Column({
    type: "enum",
    enum: TransactionType,
    enumName: "transactions_transaction_type_enum",
  })
  transactionType: TransactionType;

  @Column({
    type: "enum",
    enum: TradeMode,
    enumName: "transactions_trade_mode_enum",
  })
  tradeMode: TradeMode;

  @Column({
    type: "enum",
    enum: TransactionStatus,
    enumName: "transactions_status_enum",
    default: TransactionStatus.DRAFT,
  })
  status: TransactionStatus;

  @Column({ type: "text", nullable: true })
  remarks: string | null;

  @Column({ type: "timestamptz", name: "submitted_at", nullable: true })
  submittedAt: Date | null;

  @Column({ type: "timestamptz", name: "approved_at", nullable: true })
  approvedAt: Date | null;

  @Column({ type: "timestamptz", name: "rejected_at", nullable: true })
  rejectedAt: Date | null;

  @Column({ type: "uuid", name: "approved_by_id", nullable: true })
  approvedById: string | null;

  @Column({ type: "uuid", name: "rejected_by_id", nullable: true })
  rejectedById: string | null;

  @Column({ type: "text", name: "approval_remarks", nullable: true })
  approvalRemarks: string | null;

  @Column({ type: "text", name: "rejection_reason", nullable: true })
  rejectionReason: string | null;

  @Column({ type: "boolean", name: "is_latest", default: true })
  isLatest: boolean;

  @OneToMany(() => TransactionItem, (item) => item.transaction)
  items: TransactionItem[];

  @OneToMany(() => TransactionDocument, (document) => document.transaction)
  documents: TransactionDocument[];

  @OneToMany(
    () => TransactionAdditionalCharge,
    (charge) => charge.transaction,
  )
  additionalCharges: TransactionAdditionalCharge[];

  @OneToMany(() => TransactionPayment, (payment) => payment.transaction)
  payments: TransactionPayment[];

  @OneToMany(() => TransactionLog, (log) => log.transaction)
  logs: TransactionLog[];

  @OneToMany(() => TransactionEvent, (event) => event.transaction)
  events: TransactionEvent[];
}
