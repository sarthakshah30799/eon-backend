import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { AdvanceRefundLogAction } from "../advance-refund.enums";
import { AdvanceRefund } from "./advance-refund.entity";

@Index("IDX_advance_refund_logs_header_id", ["advanceRefundId"])
@Entity("advance_refund_logs")
export class AdvanceRefundLog extends BaseEntity {
  @Column({ type: "uuid", name: "advance_refund_id" })
  advanceRefundId: string;

  @ManyToOne(() => AdvanceRefund, (header) => header.logs, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "advance_refund_id",
    foreignKeyConstraintName: "FK_advance_refund_logs_header",
  })
  advanceRefund: AdvanceRefund;

  @Column({
    type: "enum",
    enum: AdvanceRefundLogAction,
    enumName: "advance_refund_logs_action_enum",
  })
  action: AdvanceRefundLogAction;

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
