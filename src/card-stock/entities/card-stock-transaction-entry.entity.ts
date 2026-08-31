import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { CardStockCard } from "./card-stock-card.entity";
import {
  CardStockOperationType,
  CardStockReferenceType,
} from "../card-stock.enums";
import { TransactionReferenceSnapshotValue } from "../../transactions/types/transaction-snapshot.types";
import { Transaction } from "../../transactions/entities/transaction.entity";

@Index("IDX_card_stock_entries_card_date", ["cardId", "date"])
@Index("IDX_card_stock_entries_branch_date", ["branchId", "date"])
@Index("IDX_card_stock_entries_reference", ["referenceType", "referenceId"])
@Unique("UQ_card_stock_entries_card_operation_reference", [
  "cardId",
  "referenceType",
  "referenceId",
  "operationType",
  "currencyId",
])
@Entity("card_stock_transaction_entries")
export class CardStockTransactionEntry extends BaseEntity {
  @Column({ type: "uuid", name: "card_id" })
  cardId: string;

  @ManyToOne(() => CardStockCard, (card) => card.transactionEntries, {
    onDelete: "RESTRICT",
  })
  @JoinColumn({
    name: "card_id",
    foreignKeyConstraintName: "FK_card_stock_entries_card",
  })
  card: CardStockCard;

  @Column({ type: "uuid", name: "transaction_id" })
  transactionId: string;

  @ManyToOne(() => Transaction, { onDelete: "RESTRICT" })
  @JoinColumn({
    name: "transaction_id",
    foreignKeyConstraintName: "FK_card_stock_entries_transaction",
  })
  transaction: Transaction;

  @Column({
    type: "enum",
    enum: CardStockReferenceType,
    enumName: "card_stock_reference_type_enum",
    name: "reference_type",
  })
  referenceType: CardStockReferenceType;

  @Column({ type: "uuid", name: "reference_id" })
  referenceId: string;

  @Column({
    type: "enum",
    enum: CardStockOperationType,
    name: "operation_type",
  })
  operationType: CardStockOperationType;

  @Column({ type: "uuid", name: "branch_id" })
  branchId: string;

  @Column({ type: "jsonb", name: "branch_snapshot" })
  branchSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "currency_id" })
  currencyId: string;

  @Column({ type: "jsonb", name: "currency_snapshot" })
  currencySnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "product_id" })
  productId: string;

  @Column({ type: "jsonb", name: "product_snapshot" })
  productSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "issuer_party_profile_id" })
  issuerPartyProfileId: string;

  @Column({ type: "jsonb", name: "issuer_party_profile_snapshot" })
  issuerPartyProfileSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "citext" })
  series: string;

  @Column({ type: "timestamptz", name: "date" })
  date: Date;

  @Column({ type: "numeric", precision: 18, scale: 7, default: 0 })
  rate: string;

  @Column({ type: "numeric", precision: 18, scale: 2, default: 0 })
  amount: string;

  @Column({ type: "text", nullable: true })
  remarks: string | null;
}
