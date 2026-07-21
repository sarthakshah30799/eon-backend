import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Check,
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
import { TransactionAccountPosting } from "./transaction-account-posting.entity";
import { TransactionLog } from "./transaction-log.entity";
import { TransactionEvent } from "./transaction-event.entity";
import { TransactionPassengerOtherDocument } from "./transaction-passenger-other-document.entity";
import {
  TransactionPassengerSnapshotValue,
  TransactionReferenceSnapshotValue,
} from "../types/transaction-snapshot.types";

@Index("IDX_transactions_number", ["number"], { unique: true })
@Index(
  "IDX_transactions_root_transaction_revision",
  ["rootTransactionId", "revisionNo"],
  {
    unique: true,
  },
)
@Index("IDX_transactions_root_transaction_id", ["rootTransactionId"])
@Index("IDX_transactions_branch_id", ["branchId"])
@Index("IDX_transactions_counter_id", ["counterId"])
@Index("IDX_transactions_company_id", ["companyId"])
@Index("IDX_transactions_manual_book_page_id", ["manualBookPageId"])
@Index("IDX_transactions_party_profile_id", ["partyProfileId"])
@Index("IDX_transactions_passenger_id", ["passengerId"])
@Index("IDX_transactions_purpose_id", ["purposeId"])
@Index("IDX_transactions_slug", ["slug"])
@Index("IDX_transactions_status", ["status"])
@Check(
  "CHK_transactions_number_required_when_approved",
  `"status" <> 'APPROVED' OR "number" IS NOT NULL`,
)
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

  @Column({ type: "varchar", length: 100, name: "number", nullable: true })
  number: string | null;

  @Column({ type: "citext", nullable: true })
  slug: string | null;

  @Column({ type: "uuid", name: "branch_id" })
  branchId: string;

  @Column({ type: "jsonb", name: "branch_snapshot", nullable: true })
  branchSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "counter_id", nullable: false })
  counterId: string;

  @Column({ type: "jsonb", name: "counter_snapshot", nullable: true })
  counterSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "company_id", nullable: true })
  companyId: string | null;

  @Column({ type: "jsonb", name: "company_snapshot", nullable: true })
  companySnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "citext", name: "sac_code", nullable: true })
  sacCode: string | null;

  @Column({ type: "uuid", name: "party_profile_id" })
  partyProfileId: string;

  @Column({ type: "jsonb", name: "party_profile_snapshot", nullable: true })
  partyProfileSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "purpose_id", nullable: true })
  purposeId: string | null;

  @Column({ type: "jsonb", name: "purpose_snapshot", nullable: true })
  purposeSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "passenger_id", nullable: true })
  passengerId: string | null;

  @Column({ type: "jsonb", name: "passenger_snapshot", nullable: true })
  passengerSnapshot: TransactionPassengerSnapshotValue;

  @Column({ type: "uuid", name: "agent_profile_id", nullable: true })
  agentProfileId: string | null;

  @Column({ type: "jsonb", name: "agent_profile_snapshot", nullable: true })
  agentProfileSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "manual_book_page_id", nullable: true })
  manualBookPageId: string | null;

  @Column({
    type: "jsonb",
    name: "manual_book_page_snapshot",
    nullable: true,
  })
  manualBookPageSnapshot: TransactionReferenceSnapshotValue;

  @Column({
    type: "enum",
    enum: TransactionType,
  })
  transactionType: TransactionType;

  @Column({
    type: "enum",
    enum: TradeMode,
  })
  tradeMode: TradeMode;

  @Column({
    type: "enum",
    enum: TransactionStatus,
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

  @Column({
    type: "numeric",
    name: "by_cash",
    precision: 18,
    scale: 2,
    nullable: true,
  })
  byCash: string | null;

  @Column({
    type: "numeric",
    name: "by_cheque",
    precision: 18,
    scale: 2,
    nullable: true,
  })
  byCheque: string | null;

  @Column({
    type: "numeric",
    name: "by_card",
    precision: 18,
    scale: 2,
    nullable: true,
  })
  byCard: string | null;

  @Column({
    type: "numeric",
    name: "by_transfer",
    precision: 18,
    scale: 2,
    nullable: true,
  })
  byTransfer: string | null;

  @Column({
    type: "numeric",
    name: "by_other",
    precision: 18,
    scale: 2,
    nullable: true,
  })
  byOther: string | null;

  @OneToMany(() => TransactionItem, (item) => item.transaction)
  items: TransactionItem[];

  @OneToMany(() => TransactionDocument, (document) => document.transaction)
  documents: TransactionDocument[];

  @OneToMany(
    () => TransactionPassengerOtherDocument,
    (otherDocument) => otherDocument.transaction
  )
  passengerOtherDocuments: TransactionPassengerOtherDocument[];

  @OneToMany(() => TransactionAdditionalCharge, (charge) => charge.transaction)
  additionalCharges: TransactionAdditionalCharge[];

  @OneToMany(() => TransactionPayment, (payment) => payment.transaction)
  payments: TransactionPayment[];

  @OneToMany(() => TransactionAccountPosting, (posting) => posting.transaction)
  postings: TransactionAccountPosting[];

  @OneToMany(() => TransactionLog, (log) => log.transaction)
  logs: TransactionLog[];

  @OneToMany(() => TransactionEvent, (event) => event.transaction)
  events: TransactionEvent[];
}
