import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { CardStockCardStatus } from "../card-stock.enums";
import { CardStockReceiptItem } from "./card-stock-receipt-item.entity";
import { CardTransferRequestCard } from "./card-transfer-request-card.entity";
import { CardStockTransactionEntry } from "./card-stock-transaction-entry.entity";
import { CardStockBalance } from "./card-stock-balance.entity";
import { TransactionReferenceSnapshotValue } from "../../transactions/types/transaction-snapshot.types";

@Index("IDX_card_stock_cards_receipt_item", ["receiptItemId"])
@Index("IDX_card_stock_cards_branch_status", ["currentBranchId", "status"])
@Index("IDX_card_stock_cards_kit_number", ["kitNumber"])
@Index("IDX_card_stock_cards_reserved_transfer", ["reservedByTransferId"])
@Entity("card_stock_cards")
export class CardStockCard extends BaseEntity {
  @Column({ type: "uuid", name: "receipt_item_id" })
  receiptItemId: string;

  @ManyToOne(() => CardStockReceiptItem, (item) => item.cards, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "receipt_item_id",
    foreignKeyConstraintName: "FK_card_stock_cards_receipt_item",
  })
  receiptItem: CardStockReceiptItem;

  @Column({ type: "citext" })
  series: string;

  @Column({ type: "integer", default: 1 })
  quantity: number;

  @Column({ type: "citext", name: "kit_number" })
  kitNumber: string;

  @Column({ type: "bytea", name: "card_number" })
  cardNumber: Buffer;

  @Column({ type: "numeric", precision: 18, scale: 2 })
  denomination: string;

  @Column({ type: "numeric", precision: 18, scale: 2 })
  amount: string;

  @Column({ type: "date", name: "expiration_date" })
  expirationDate: string;

  @Column({ type: "uuid", name: "current_branch_id" })
  currentBranchId: string;

  @Column({ type: "jsonb", name: "current_branch_snapshot" })
  currentBranchSnapshot: TransactionReferenceSnapshotValue;

  @Column({
    type: "enum",
    enum: CardStockCardStatus,
    default: CardStockCardStatus.AVAILABLE,
  })
  status: CardStockCardStatus;

  @Column({ type: "uuid", name: "reserved_by_transfer_id", nullable: true })
  reservedByTransferId: string | null;

  @Column({ type: "timestamptz", name: "reserved_at", nullable: true })
  reservedAt: Date | null;

  @OneToMany(() => CardTransferRequestCard, (selection) => selection.card)
  transferSelections: CardTransferRequestCard[];

  @OneToMany(() => CardStockTransactionEntry, (entry) => entry.card)
  transactionEntries: CardStockTransactionEntry[];

  @OneToMany(() => CardStockBalance, (balance) => balance.card)
  balances: CardStockBalance[];
}
