import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { AdvanceAdjustmentLogAction } from "../advance-adjustment.enums";
import { AdvanceAdjustment } from "./advance-adjustment.entity";

@Index("IDX_advance_adjustment_logs_header_id", ["advanceAdjustmentId"])
@Entity("advance_adjustment_logs")
export class AdvanceAdjustmentLog extends BaseEntity {
  @Column({ type: "uuid", name: "advance_adjustment_id" })
  advanceAdjustmentId: string;

  @ManyToOne(() => AdvanceAdjustment, (header) => header.logs, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "advance_adjustment_id",
    foreignKeyConstraintName: "FK_advance_adjustment_logs_header",
  })
  advanceAdjustment: AdvanceAdjustment;

  @Column({
    type: "enum",
    enum: AdvanceAdjustmentLogAction,
    enumName: "advance_adjustment_logs_action_enum",
  })
  action: AdvanceAdjustmentLogAction;

  @Column({ type: "text" })
  message: string;

  @Column({ type: "jsonb", name: "before_snapshot", nullable: true })
  beforeSnapshot: Record<string, unknown> | null;

  @Column({ type: "jsonb", name: "after_snapshot", nullable: true })
  afterSnapshot: Record<string, unknown> | null;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: "uuid", name: "performed_by_id", nullable: true })
  performedById: string | null;

  @Column({ type: "citext", name: "performed_by_name", nullable: true })
  performedByName: string | null;

  @Column({
    type: "timestamptz",
    name: "performed_at",
    default: () => "now()",
  })
  performedAt: Date;
}
