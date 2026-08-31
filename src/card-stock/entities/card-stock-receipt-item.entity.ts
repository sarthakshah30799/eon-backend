import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { CardStockReceipt } from "./card-stock-receipt.entity";
import { CardStockCard } from "./card-stock-card.entity";
import { TransactionReferenceSnapshotValue } from "../../transactions/types/transaction-snapshot.types";

@Index("IDX_card_stock_receipt_items_receipt_line", ["receiptId", "lineNo"], {
  unique: true,
})
@Index("IDX_card_stock_receipt_items_currency", ["currencyId"])
@Index("IDX_card_stock_receipt_items_product", ["productId"])
@Index("IDX_card_stock_receipt_items_issuer", ["issuerPartyProfileId"])
@Entity("card_stock_receipt_items")
export class CardStockReceiptItem extends BaseEntity {
  @Column({ type: "uuid", name: "receipt_id" })
  receiptId: string;

  @ManyToOne(() => CardStockReceipt, (receipt) => receipt.items, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "receipt_id",
    foreignKeyConstraintName: "FK_card_stock_receipt_items_receipt",
  })
  receipt: CardStockReceipt;

  @Column({ type: "integer", name: "line_no" })
  lineNo: number;

  @Column({ type: "uuid", name: "currency_id" })
  currencyId: string;

  @Column({ type: "jsonb", name: "currency_snapshot" })
  currencySnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "numeric", precision: 18, scale: 7 })
  per: string;

  @Column({ type: "uuid", name: "product_id" })
  productId: string;

  @Column({ type: "jsonb", name: "product_snapshot" })
  productSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "issuer_party_profile_id" })
  issuerPartyProfileId: string;

  @Column({ type: "jsonb", name: "issuer_party_profile_snapshot" })
  issuerPartyProfileSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "numeric", precision: 18, scale: 2, name: "fe_amount" })
  feAmount: string;

  @OneToMany(() => CardStockCard, (card) => card.receiptItem, { cascade: true })
  cards: CardStockCard[];
}
