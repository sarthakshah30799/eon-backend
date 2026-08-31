import { Column, Entity, Index, OneToMany } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { StockRevaluationItem } from "./stock-revaluation-item.entity";
import {
  StockRevaluationFrequency,
  StockRevaluationStatus,
} from "../stock-revaluation.enums";

@Index(
  "IDX_stock_revaluations_branch_counter_period",
  ["branchId", "counterId", "frequency", "valuationDate"],
  {
    unique: true,
  },
)
@Index("IDX_stock_revaluations_branch_date", ["branchId", "valuationDate"])
@Entity("stock_revaluations")
export class StockRevaluation extends BaseEntity {
  @Column({ type: "uuid", name: "branch_id" })
  branchId: string;

  @Column({ type: "uuid", name: "counter_id" })
  counterId: string;

  @Column({ type: "jsonb", name: "branch_snapshot", nullable: true })
  branchSnapshot: Record<string, unknown> | null;

  @Column({ type: "jsonb", name: "counter_snapshot", nullable: true })
  counterSnapshot: Record<string, unknown> | null;

  @Column({
    type: "enum",
    enum: StockRevaluationFrequency,
    enumName: "stock_revaluation_frequency_enum",
  })
  frequency: StockRevaluationFrequency;

  @Column({ type: "date", name: "valuation_date" })
  valuationDate: string;

  @Column({ type: "date", name: "uploaded_date" })
  uploadedDate: string;

  @Column({
    type: "enum",
    enum: StockRevaluationStatus,
    enumName: "stock_revaluation_status_enum",
    default: StockRevaluationStatus.PENDING,
  })
  status: StockRevaluationStatus;

  @Column({ type: "jsonb", name: "uploaded_rates", nullable: true })
  uploadedRates: Array<{
    currencyId: string;
    currencyCode: string;
    currencyName: string;
    rate: string;
  }> | null;

  @OneToMany(() => StockRevaluationItem, (item) => item.revaluation, {
    cascade: true,
  })
  items: StockRevaluationItem[];
}
