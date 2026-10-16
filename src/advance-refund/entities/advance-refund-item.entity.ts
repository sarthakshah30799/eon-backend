import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { AdvanceRefund } from "./advance-refund.entity";

@Entity("advance_refund_items")
@Index("IDX_advance_refund_items_header_id", ["advanceRefundId"])
@Index("IDX_advance_refund_items_receipt_voucher_id", ["receiptVoucherId"])
@Check("CHK_advance_refund_item_amount_positive", `"refund_amount" > 0`)
export class AdvanceRefundItem extends BaseEntity {
  @Column({ type: "uuid", name: "advance_refund_id" })
  advanceRefundId: string;

  @ManyToOne(() => AdvanceRefund, (header) => header.items, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "advance_refund_id",
    foreignKeyConstraintName: "FK_advance_refund_items_header",
  })
  advanceRefund: AdvanceRefund;

  @Column({ type: "integer", name: "line_no" })
  lineNo: number;

  @Column({ type: "uuid", name: "receipt_voucher_id" })
  receiptVoucherId: string;

  @Column({ type: "jsonb", name: "receipt_voucher_snapshot" })
  receiptVoucherSnapshot: Record<string, any>;

  @Column({
    type: "numeric",
    precision: 18,
    scale: 2,
    name: "original_receipt_amount",
  })
  originalReceiptAmount: string;

  @Column({
    type: "numeric",
    precision: 18,
    scale: 2,
    name: "consumed_amount",
  })
  consumedAmount: string;

  @Column({
    type: "numeric",
    precision: 18,
    scale: 2,
    name: "available_amount",
  })
  availableAmount: string;

  @Column({
    type: "numeric",
    precision: 18,
    scale: 2,
    name: "refund_amount",
  })
  refundAmount: string;
}
