import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { TransactionReferenceSnapshotValue } from "../types/transaction-snapshot.types";

@Index(
  "IDX_transaction_balance_currencies_bucket",
  ["date", "branchId", "counterId", "currencyId", "profileType"],
  {
    unique: true,
  },
)
@Index("IDX_transaction_balance_currencies_branch_counter_date", [
  "branchId",
  "counterId",
  "date",
])
@Index("IDX_transaction_balance_currencies_currency_id", ["currencyId"])
@Entity("transaction_balance_currencies")
export class TransactionBalanceCurrency extends BaseEntity {
  @Column({ type: "timestamptz" })
  date: Date;

  @Column({ type: "uuid", name: "branch_id" })
  branchId: string;

  @Column({ type: "jsonb", name: "branchsnapshot", nullable: true })
  branchSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "counter_id" })
  counterId: string;

  @Column({ type: "jsonb", name: "countersnapshot", nullable: true })
  counterSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "currency_id" })
  currencyId: string;

  @Column({ type: "jsonb", name: "currencysnapshot", nullable: true })
  currencySnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "citext", name: "profiletype" })
  profileType: string;

  @Column({ type: "numeric", precision: 18, scale: 7, default: 0 })
  opening: string;

  @Column({
    type: "numeric",
    name: "openingrs",
    precision: 18,
    scale: 2,
    default: 0,
  })
  openingRs: string;

  @Column({ type: "numeric", precision: 18, scale: 7, default: 0 })
  purchase: string;

  @Column({
    type: "numeric",
    name: "purchasers",
    precision: 18,
    scale: 2,
    default: 0,
  })
  purchaseRs: string;

  @Column({ type: "numeric", precision: 18, scale: 7, default: 0 })
  sell: string;

  @Column({
    type: "numeric",
    name: "sellrs",
    precision: 18,
    scale: 2,
    default: 0,
  })
  sellRs: string;

  @Column({
    type: "numeric",
    name: "adjustsellrs",
    precision: 18,
    scale: 2,
    default: 0,
  })
  adjustSellRs: string;

  @Column({ type: "numeric", precision: 18, scale: 7, default: 0 })
  closing: string;

  @Column({
    type: "numeric",
    name: "closingrs",
    precision: 18,
    scale: 2,
    default: 0,
  })
  closingRs: string;
}
