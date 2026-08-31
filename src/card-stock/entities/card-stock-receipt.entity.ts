import { Column, Entity, Index, OneToMany } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { CardStockReceiptStatus } from "../card-stock.enums";
import { CardStockReceiptItem } from "./card-stock-receipt-item.entity";
import { TransactionReferenceSnapshotValue } from "../../transactions/types/transaction-snapshot.types";
import type { Company } from "../../company/company.entity";

@Index("IDX_card_stock_receipts_transaction_number", ["transactionNumber"], {
  unique: true,
})
@Index("IDX_card_stock_receipts_date", ["receiptDate"])
@Entity("card_stock_receipts")
export class CardStockReceipt extends BaseEntity {
  @Column({ type: "citext", name: "transaction_number" })
  transactionNumber: string;

  @Column({ type: "date", name: "receipt_date" })
  receiptDate: string;

  @Column({ type: "uuid", name: "branch_id" })
  branchId: string;

  @Column({ type: "jsonb", name: "branch_snapshot" })
  branchSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "company_id", nullable: true })
  companyId: string | null;

  @Column({ type: "jsonb", name: "company_snapshot", nullable: true })
  companySnapshot: Company | null;

  @Column({ type: "uuid", name: "issuer_party_profile_id" })
  issuerPartyProfileId: string;

  @Column({ type: "jsonb", name: "issuer_party_profile_snapshot" })
  issuerPartyProfileSnapshot: TransactionReferenceSnapshotValue;

  @Column({
    type: "enum",
    enum: CardStockReceiptStatus,
    name: "status",
    default: CardStockReceiptStatus.POSTED,
  })
  status: CardStockReceiptStatus;

  @Column({ type: "numeric", precision: 18, scale: 2, name: "total_fe_amount" })
  totalFeAmount: string;

  @Column({ type: "uuid", name: "transaction_id", nullable: true })
  transactionId: string | null;

  @OneToMany(() => CardStockReceiptItem, (item) => item.receipt, {
    cascade: true,
  })
  items: CardStockReceiptItem[];
}
