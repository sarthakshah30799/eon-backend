import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { VoucherLogAction } from "../voucher.enums";
import { AccountingVoucher } from "./accounting-voucher.entity";

@Index("IDX_accounting_voucher_logs_voucher_id", ["voucherId"])
@Entity("accounting_voucher_logs")
export class AccountingVoucherLog extends BaseEntity {
  @Column({ type: "uuid", name: "voucher_id" })
  voucherId: string;

  @ManyToOne(() => AccountingVoucher, (voucher) => voucher.logs, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "voucher_id",
    foreignKeyConstraintName: "FK_accounting_voucher_logs_voucher_id",
  })
  voucher: AccountingVoucher;

  @Column({
    type: "enum",
    enum: VoucherLogAction,
  })
  action: VoucherLogAction;

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

  @Column({ type: "timestamptz", name: "performed_at", default: () => "now()" })
  performedAt: Date;
}
