import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { AdvanceAdjustment } from "./advance-adjustment.entity";

@Entity("advance_adjustment_items")
@Index("IDX_advance_adjustment_items_header_id", ["advanceAdjustmentId"])
@Index("IDX_advance_adjustment_items_transaction_id", ["transactionId"])
@Index("UQ_advance_adjustment_items_header_transaction", [
  "advanceAdjustmentId",
  "transactionId",
], { unique: true })
@Check("CHK_advance_adjustment_item_amount_positive", `"adjustment_amount" > 0`)
export class AdvanceAdjustmentItem extends BaseEntity {
  @Column({ type: "uuid", name: "advance_adjustment_id" })
  advanceAdjustmentId: string;

  @ManyToOne(() => AdvanceAdjustment, (header) => header.items, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "advance_adjustment_id",
    foreignKeyConstraintName: "FK_advance_adjustment_items_header",
  })
  advanceAdjustment: AdvanceAdjustment;

  @Column({ type: "integer", name: "line_no" })
  lineNo: number;

  @Column({ type: "uuid", name: "transaction_id" })
  transactionId: string;

  @Column({ type: "jsonb", name: "transaction_snapshot" })
  transactionSnapshot: Record<string, any>;

  @Column({
    type: "numeric",
    precision: 18,
    scale: 2,
    name: "final_amount",
  })
  finalAmount: string;

  @Column({
    type: "numeric",
    precision: 18,
    scale: 2,
    name: "outstanding_amount",
  })
  outstandingAmount: string;

  @Column({
    type: "numeric",
    precision: 18,
    scale: 2,
    name: "adjustment_amount",
  })
  adjustmentAmount: string;
}
