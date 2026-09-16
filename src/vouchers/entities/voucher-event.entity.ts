import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { VoucherEventStatus } from "../voucher.enums";
import { AccountingVoucher } from "./accounting-voucher.entity";

@Index("IDX_voucher_events_voucher_id", ["voucherId"])
@Index("IDX_voucher_events_status_available_at", ["status", "availableAt"])
@Entity("voucher_events")
export class VoucherEvent extends BaseEntity {
  @Column({ type: "uuid", name: "voucher_id" })
  voucherId: string;

  @ManyToOne(() => AccountingVoucher, (voucher) => voucher.events, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "voucher_id",
    foreignKeyConstraintName: "FK_voucher_events_voucher_id",
  })
  voucher: AccountingVoucher;

  @Column({ type: "text", name: "event_type" })
  eventType: string;

  @Column({ type: "jsonb", nullable: false })
  payload: Record<string, unknown>;

  @Column({
    type: "enum",
    enum: VoucherEventStatus,
    default: VoucherEventStatus.PENDING,
  })
  status: VoucherEventStatus;

  @Column({ type: "integer", name: "attempt_count", default: 0 })
  attemptCount: number;

  @Column({ type: "timestamptz", name: "available_at", default: () => "now()" })
  availableAt: Date;

  @Column({ type: "timestamptz", name: "processed_at", nullable: true })
  processedAt: Date | null;

  @Column({ type: "text", name: "error_message", nullable: true })
  errorMessage: string | null;

  @Column({ type: "timestamptz", name: "locked_at", nullable: true })
  lockedAt: Date | null;

  @Column({ type: "uuid", name: "locked_by_id", nullable: true })
  lockedById: string | null;
}
