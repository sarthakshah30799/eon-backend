import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { StockRevaluation } from "./stock-revaluation.entity";

@Index(
  "IDX_stock_revaluation_items_revaluation_line",
  ["revaluationId", "lineNo"],
  { unique: true },
)
@Index("IDX_stock_revaluation_items_currency", ["currencyId"])
@Entity("stock_revaluation_items")
export class StockRevaluationItem extends BaseEntity {
  @Column({ type: "uuid", name: "revaluation_id" })
  revaluationId: string;

  @ManyToOne(() => StockRevaluation, (revaluation) => revaluation.items, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "revaluation_id",
    foreignKeyConstraintName: "FK_stock_revaluation_items_revaluation",
  })
  revaluation: StockRevaluation;

  @Column({ type: "integer", name: "line_no" })
  lineNo: number;

  @Column({ type: "uuid", name: "currency_id" })
  currencyId: string;

  @Column({ type: "jsonb", name: "currency_snapshot", nullable: true })
  currencySnapshot: Record<string, unknown> | null;

  @Column({
    type: "numeric",
    precision: 18,
    scale: 7,
    name: "closing_quantity",
    default: 0,
  })
  closingQuantity: string;

  @Column({ type: "numeric", precision: 18, scale: 7, name: "awp", default: 0 })
  awp: string;

  @Column({
    type: "numeric",
    precision: 18,
    scale: 2,
    name: "closing_inr_amount",
    default: 0,
  })
  closingInrAmount: string;

  @Column({ type: "numeric", precision: 18, scale: 7, name: "new_rate" })
  newRate: string;

  @Column({
    type: "numeric",
    precision: 18,
    scale: 2,
    name: "new_inr_amount",
    default: 0,
  })
  newInrAmount: string;

  @Column({
    type: "numeric",
    precision: 18,
    scale: 2,
    name: "difference_inr",
    default: 0,
  })
  differenceInr: string;
}
