import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { AdvanceAdjustmentPrintCopyType } from "../advance-adjustment.enums";
import { AdvanceAdjustment } from "./advance-adjustment.entity";

@Entity("advance_adjustment_print_logs")
@Index("IDX_advance_adjustment_print_logs_header", ["advanceAdjustmentId"])
export class AdvanceAdjustmentPrintLog extends BaseEntity {
  @Column({ type: "uuid", name: "advance_adjustment_id" })
  advanceAdjustmentId: string;

  @ManyToOne(() => AdvanceAdjustment, (header) => header.printLogs, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "advance_adjustment_id",
    foreignKeyConstraintName: "FK_advance_adjustment_print_logs_header",
  })
  advanceAdjustment: AdvanceAdjustment;

  @Column({
    type: "enum",
    enum: AdvanceAdjustmentPrintCopyType,
    name: "copy_type",
  })
  copyType: AdvanceAdjustmentPrintCopyType;

  @Column({ type: "text" })
  message: string;

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
