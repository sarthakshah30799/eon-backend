import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { TransactionReferenceSnapshotValue } from "../../transactions/types/transaction-snapshot.types";
import {
  ProductSettlementMode,
  ProductSettlementSaleKind,
  ProductSettlementStatus,
  ProductSettlementType,
} from "../product-settlement.enums";
import { CardStockCard } from "../../card-stock/entities/card-stock-card.entity";
import { ProductSettlementDocument } from "./product-settlement-document.entity";
import { CardStockTransactionEntry } from "../../card-stock/entities/card-stock-transaction-entry.entity";
import { Transaction } from "../../transactions/entities/transaction.entity";
import { TransactionItem } from "../../transactions/entities/transaction-item.entity";
import { DealCover } from "../../tt-deal/entities/deal-cover.entity";

@Index("IDX_product_settlements_status", ["status"])
@Index("IDX_product_settlements_branch", ["branchId"])
@Index("IDX_product_settlements_issuer", ["issuerPartyProfileId"])
@Index("IDX_product_settlements_sale_date", ["saleDate"])
@Index("IDX_product_settlements_type", ["type"])
@Index("IDX_product_settlements_product_code", ["productCode"])
@Index("IDX_product_settlements_deal_cover", ["dealCoverId"])
@Index("UQ_product_settlements_card_item", ["cardId", "transactionItemId"], {
  unique: true,
  where: '"card_id" IS NOT NULL AND "deleted_at" IS NULL',
})
@Index(
  "UQ_product_settlements_deal_item",
  ["dealCoverId", "transactionItemId"],
  {
    unique: true,
    where: '"deal_cover_id" IS NOT NULL AND "deleted_at" IS NULL',
  },
)
@Index("IDX_product_settlements_branch_document", ["branchDocumentId"])
@Index("IDX_product_settlements_issuer_document", ["issuerDocumentId"])
@Entity("product_settlements")
export class ProductSettlement extends BaseEntity {
  @Column({ type: "citext", name: "type", default: ProductSettlementType.CARD })
  type: ProductSettlementType;

  @Column({ type: "citext", name: "product_code" })
  productCode: string;

  @Column({ type: "uuid", name: "card_id", nullable: true })
  cardId: string | null;

  @ManyToOne(() => CardStockCard, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({
    name: "card_id",
    foreignKeyConstraintName: "FK_product_settlements_card",
  })
  card: CardStockCard | null;

  @Column({ type: "uuid", name: "deal_cover_id", nullable: true })
  dealCoverId: string | null;

  @ManyToOne(() => DealCover, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({
    name: "deal_cover_id",
    foreignKeyConstraintName: "FK_product_settlements_deal_cover",
  })
  dealCover: DealCover | null;

  @Column({ type: "uuid", name: "transaction_id" })
  transactionId: string;

  @ManyToOne(() => Transaction, { onDelete: "RESTRICT" })
  @JoinColumn({
    name: "transaction_id",
    foreignKeyConstraintName: "FK_product_settlements_transaction",
  })
  transaction: Transaction;

  @Column({ type: "uuid", name: "transaction_item_id" })
  transactionItemId: string;

  @ManyToOne(() => TransactionItem, { onDelete: "RESTRICT" })
  @JoinColumn({
    name: "transaction_item_id",
    foreignKeyConstraintName: "FK_product_settlements_transaction_item",
  })
  transactionItem: TransactionItem;

  @Column({ type: "uuid", name: "branch_id" })
  branchId: string;

  @Column({ type: "jsonb", name: "branch_snapshot" })
  branchSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "ho_branch_id" })
  hoBranchId: string;

  @Column({ type: "jsonb", name: "ho_branch_snapshot" })
  hoBranchSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "issuer_party_profile_id" })
  issuerPartyProfileId: string;

  @Column({ type: "jsonb", name: "issuer_party_profile_snapshot" })
  issuerPartyProfileSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "currency_id" })
  currencyId: string;

  @Column({ type: "jsonb", name: "currency_snapshot" })
  currencySnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "product_id" })
  productId: string;

  @Column({ type: "jsonb", name: "product_snapshot" })
  productSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "passenger_id", nullable: true })
  passengerId: string | null;

  @Column({ type: "jsonb", name: "passenger_snapshot", nullable: true })
  passengerSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "citext" })
  series: string;

  @Column({ type: "numeric", precision: 18, scale: 2 })
  denomination: string;

  @Column({ type: "numeric", precision: 18, scale: 7, name: "sale_buy_rate" })
  saleBuyRate: string;

  @Column({ type: "numeric", precision: 18, scale: 7, name: "buy_rate" })
  buyRate: string;

  @Column({
    type: "numeric",
    precision: 18,
    scale: 7,
    name: "booking_rate",
    nullable: true,
  })
  bookingRate: string | null;

  @Column({ type: "jsonb", name: "buy_rate_snapshot" })
  buyRateSnapshot: Record<string, unknown>;

  @Column({
    type: "numeric",
    precision: 18,
    scale: 2,
    name: "settlement_amount",
  })
  settlementAmount: string;

  @Column({
    type: "numeric",
    precision: 18,
    scale: 7,
    name: "issuer_rate",
    nullable: true,
  })
  issuerRate: string | null;

  @Column({
    type: "numeric",
    precision: 18,
    scale: 2,
    name: "issuer_settlement_amount",
    nullable: true,
  })
  issuerSettlementAmount: string | null;

  @Column({ type: "uuid", name: "branch_document_id", nullable: true })
  branchDocumentId: string | null;

  @ManyToOne(
    () => ProductSettlementDocument,
    (document) => document.branchItems,
    { onDelete: "RESTRICT", nullable: true },
  )
  @JoinColumn({
    name: "branch_document_id",
    foreignKeyConstraintName: "FK_product_settlements_branch_document",
  })
  branchDocument: ProductSettlementDocument | null;

  @Column({ type: "uuid", name: "issuer_document_id", nullable: true })
  issuerDocumentId: string | null;

  @ManyToOne(
    () => ProductSettlementDocument,
    (document) => document.issuerItems,
    { onDelete: "RESTRICT", nullable: true },
  )
  @JoinColumn({
    name: "issuer_document_id",
    foreignKeyConstraintName: "FK_product_settlements_issuer_document",
  })
  issuerDocument: ProductSettlementDocument | null;

  @Column({ type: "timestamptz", name: "sale_date" })
  saleDate: Date;

  @Column({
    type: "enum",
    enum: ProductSettlementMode,
    name: "settlement_mode",
  })
  settlementMode: ProductSettlementMode;

  @Column({
    type: "citext",
    name: "sale_kind",
    default: ProductSettlementSaleKind.FRESH,
  })
  saleKind: ProductSettlementSaleKind;

  @Column({
    type: "timestamptz",
    name: "branch_requested_date",
    nullable: true,
  })
  branchRequestedDate: Date | null;

  @Column({ type: "citext", name: "branch_reference", nullable: true })
  branchReference: string | null;

  @Column({ type: "text", name: "branch_remarks", nullable: true })
  branchRemarks: string | null;

  @Column({ type: "timestamptz", name: "branch_requested_at", nullable: true })
  branchRequestedAt: Date | null;

  @Column({ type: "uuid", name: "branch_requested_by_id", nullable: true })
  branchRequestedById: string | null;

  @Column({ type: "timestamptz", name: "ho_accepted_at", nullable: true })
  hoAcceptedAt: Date | null;

  @Column({ type: "uuid", name: "ho_accepted_by_id", nullable: true })
  hoAcceptedById: string | null;

  @Column({ type: "timestamptz", name: "ho_rejected_at", nullable: true })
  hoRejectedAt: Date | null;

  @Column({ type: "uuid", name: "ho_rejected_by_id", nullable: true })
  hoRejectedById: string | null;

  @Column({ type: "text", name: "ho_rejection_reason", nullable: true })
  hoRejectionReason: string | null;

  @Column({
    type: "timestamptz",
    name: "branch_settlement_date",
    nullable: true,
  })
  branchSettlementDate: Date | null;

  @Column({ type: "uuid", name: "branch_settlement_entry_id", nullable: true })
  branchSettlementEntryId: string | null;

  @ManyToOne(() => CardStockTransactionEntry, {
    onDelete: "RESTRICT",
    nullable: true,
  })
  @JoinColumn({
    name: "branch_settlement_entry_id",
    foreignKeyConstraintName: "FK_product_settlements_branch_entry",
  })
  branchSettlementEntry: CardStockTransactionEntry | null;

  @Column({
    type: "timestamptz",
    name: "issuer_settlement_date",
    nullable: true,
  })
  issuerSettlementDate: Date | null;

  @Column({ type: "citext", name: "issuer_reference", nullable: true })
  issuerReference: string | null;

  @Column({ type: "text", name: "issuer_remarks", nullable: true })
  issuerRemarks: string | null;

  @Column({ type: "uuid", name: "issuer_settlement_entry_id", nullable: true })
  issuerSettlementEntryId: string | null;

  @ManyToOne(() => CardStockTransactionEntry, {
    onDelete: "RESTRICT",
    nullable: true,
  })
  @JoinColumn({
    name: "issuer_settlement_entry_id",
    foreignKeyConstraintName: "FK_product_settlements_issuer_entry",
  })
  issuerSettlementEntry: CardStockTransactionEntry | null;

  @Column({ type: "enum", enum: ProductSettlementStatus, name: "status" })
  status: ProductSettlementStatus;

  @Column({ type: "timestamptz", name: "cancelled_at", nullable: true })
  cancelledAt: Date | null;

  @Column({ type: "uuid", name: "cancelled_by_id", nullable: true })
  cancelledById: string | null;

  @Column({ type: "text", name: "cancellation_reason", nullable: true })
  cancellationReason: string | null;
}
