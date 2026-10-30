import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { AdvanceRefundPrintCopyType } from "../advance-refund.enums";
import { AdvanceRefund } from "./advance-refund.entity";

@Entity("advance_refund_print_logs")
@Index("IDX_advance_refund_print_logs_header", ["advanceRefundId"])
export class AdvanceRefundPrintLog extends BaseEntity {
  @Column({ type: "uuid", name: "advance_refund_id" })
  advanceRefundId: string;

  @ManyToOne(() => AdvanceRefund, (header) => header.printLogs, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "advance_refund_id",
    foreignKeyConstraintName: "FK_advance_refund_print_logs_header",
  })
  advanceRefund: AdvanceRefund;

  @Column({
    type: "enum",
    enum: AdvanceRefundPrintCopyType,
    name: "copy_type",
  })
  copyType: AdvanceRefundPrintCopyType;

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
