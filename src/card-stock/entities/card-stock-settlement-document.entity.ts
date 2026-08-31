import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { Transaction } from "../../transactions/entities/transaction.entity";
import { TransactionReferenceSnapshotValue } from "../../transactions/types/transaction-snapshot.types";
import {
  CardStockSettlementDocumentKind,
  CardStockSettlementDocumentStatus,
} from "../card-stock.enums";
import { CardStockSettlement } from "./card-stock-settlement.entity";

@Index("IDX_card_stock_settlement_documents_number", ["transactionNumber"], {
  unique: true,
})
@Index("IDX_card_stock_settlement_documents_status", ["status"])
@Index("IDX_card_stock_settlement_documents_kind", ["kind"])
@Index("IDX_card_stock_settlement_documents_date", ["transactionDate"])
@Index("IDX_card_stock_settlement_documents_issuer", ["issuerPartyProfileId"])
@Index("IDX_card_stock_settlement_documents_branch", ["branchId"])
@Entity("card_stock_settlement_documents")
export class CardStockSettlementDocument extends BaseEntity {
  @Column({ type: "citext", name: "transaction_number" })
  transactionNumber: string;

  @Column({ type: "timestamptz", name: "transaction_date" })
  transactionDate: Date;

  @Column({ type: "citext" })
  kind: CardStockSettlementDocumentKind;

  @Column({ type: "citext" })
  status: CardStockSettlementDocumentStatus;

  @Column({ type: "uuid", name: "issuer_party_profile_id" })
  issuerPartyProfileId: string;

  @Column({ type: "jsonb", name: "issuer_party_profile_snapshot" })
  issuerPartyProfileSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "currency_id" })
  currencyId: string;

  @Column({ type: "jsonb", name: "currency_snapshot" })
  currencySnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "branch_id" })
  branchId: string;

  @Column({ type: "jsonb", name: "branch_snapshot" })
  branchSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "ho_branch_id" })
  hoBranchId: string;

  @Column({ type: "jsonb", name: "ho_branch_snapshot" })
  hoBranchSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "citext", nullable: true })
  reference: string | null;

  @Column({ type: "text", nullable: true })
  remarks: string | null;

  @Column({ type: "text", name: "rejection_reason", nullable: true })
  rejectionReason: string | null;

  @Column({ type: "text", name: "cancellation_reason", nullable: true })
  cancellationReason: string | null;

  @Column({ type: "timestamptz", name: "accepted_at", nullable: true })
  acceptedAt: Date | null;

  @Column({ type: "uuid", name: "accepted_by_id", nullable: true })
  acceptedById: string | null;

  @Column({ type: "timestamptz", name: "rejected_at", nullable: true })
  rejectedAt: Date | null;

  @Column({ type: "uuid", name: "rejected_by_id", nullable: true })
  rejectedById: string | null;

  @Column({ type: "timestamptz", name: "cancelled_at", nullable: true })
  cancelledAt: Date | null;

  @Column({ type: "uuid", name: "cancelled_by_id", nullable: true })
  cancelledById: string | null;

  @Column({ type: "uuid", name: "posting_transaction_id", nullable: true })
  postingTransactionId: string | null;

  @ManyToOne(() => Transaction, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({
    name: "posting_transaction_id",
    foreignKeyConstraintName: "FK_card_stock_settlement_documents_posting",
  })
  postingTransaction: Transaction | null;

  @OneToMany(() => CardStockSettlement, (item) => item.branchDocument)
  branchItems: CardStockSettlement[];

  @OneToMany(() => CardStockSettlement, (item) => item.issuerDocument)
  issuerItems: CardStockSettlement[];
}
