import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { Transaction } from "./transaction.entity";
import {
  TransactionItemSnapshot,
  TransactionPricingRuleSnapshotValue,
  TransactionReferenceSnapshotValue,
} from "../types/transaction-snapshot.types";

@Index("IDX_transaction_items_transaction_id", ["transactionId"])
@Index("IDX_transaction_items_transaction_line", ["transactionId", "lineNo"], {
  unique: true,
})
@Index("IDX_transaction_items_account_id", ["accountId"])
@Entity("transaction_items")
export class TransactionItem extends BaseEntity {
  @Column({ type: "uuid", name: "transaction_id" })
  transactionId: string;

  @ManyToOne(() => Transaction, (transaction) => transaction.items, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "transaction_id",
    foreignKeyConstraintName: "FK_transaction_items_transaction_id",
  })
  transaction: Transaction;

  @Column({ type: "integer", name: "line_no" })
  lineNo: number;

  @Column({ type: "uuid", name: "currency_id" })
  currencyId: string;

  @Column({ type: "uuid", name: "product_id" })
  productId: string;

  @Column({ type: "uuid", name: "account_id", nullable: true })
  accountId: string | null;

  @Column({ type: "jsonb", name: "account_snapshot", nullable: true })
  accountSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "currency_rate_id", nullable: true })
  currencyRateId: string | null;

  @Column({
    type: "uuid",
    name: "product_currency_rate_id",
    nullable: true,
  })
  productCurrencyRateId: string | null;

  @Column({ type: "numeric", name: "quantity", precision: 18, scale: 7 })
  quantity: string;

  @Column({ type: "numeric", name: "per", nullable: true })
  per: string | null;

  @Column({ type: "numeric", name: "rate", precision: 18, scale: 7 })
  rate: string;

  @Column({ type: "numeric", name: "commission", precision: 18, scale: 2, nullable: true })
  commission: string | null;

  @Column({ type: "numeric", name: "hold_cost", precision: 18, scale: 7, nullable: true })
  holdCost: string | null;

  @Column({ type: "numeric", name: "profit", precision: 18, scale: 2, nullable: true })
  profit: string | null;

  @Column({
    type: "numeric",
    name: "round_off",
    precision: 18,
    scale: 2,
    nullable: true,
  })
  roundOff: string | null;

  @Column({ type: "jsonb", name: "currency_snapshot", nullable: true })
  currencySnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "jsonb", name: "product_snapshot", nullable: true })
  productSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "jsonb", name: "currency_rate_snapshot", nullable: true })
  currencyRateSnapshot: TransactionItemSnapshot | null;

  @Column({
    type: "jsonb",
    name: "product_currency_rate_snapshot",
    nullable: true,
  })
  productCurrencyRateSnapshot: TransactionPricingRuleSnapshotValue;

  @Column({ type: "jsonb", name: "pricing_rule_snapshot", nullable: true })
  pricingRuleSnapshot: TransactionPricingRuleSnapshotValue;

  @Column({ type: "jsonb", name: "commission_snapshot", nullable: true })
  commissionSnapshot: TransactionPricingRuleSnapshotValue;

  @Column({ type: "text", nullable: true })
  remarks: string | null;

  private recalculateRoundOff() {
    const quantity = Number(this.quantity);
    const rate = Number(this.rate);
    const per = Number(this.per ?? 1) || 1;

    if (!Number.isFinite(quantity) || !Number.isFinite(rate) || per === 0) {
      this.roundOff = null;
      return;
    }

    const totalAmount = quantity * (rate / per);
    const roundedAmount = Math.round(totalAmount);
    this.roundOff = (roundedAmount - totalAmount).toFixed(2);
  }

  @BeforeInsert()
  @BeforeUpdate()
  beforeSave() {
    this.recalculateRoundOff();
  }
}
