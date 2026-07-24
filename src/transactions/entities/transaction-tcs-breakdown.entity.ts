import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { PurposeRateType } from "../../purpose/purpose.enums";
import { Transaction } from "./transaction.entity";

@Index("IDX_transaction_tcs_breakdowns_transaction_id", ["transactionId"])
@Index("IDX_transaction_tcs_breakdowns_transaction_line", ["transactionId", "lineNo"], {
  unique: true,
})
@Index("IDX_transaction_tcs_breakdowns_purpose_id", ["purposeId"])
@Entity("transaction_tcs_breakdowns")
export class TransactionTcsBreakdown extends BaseEntity {
  @Column({ type: "uuid", name: "transaction_id" })
  transactionId: string;

  @ManyToOne(() => Transaction, transaction => transaction.tcsBreakdowns, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "transaction_id",
    foreignKeyConstraintName: "FK_transaction_tcs_breakdowns_transaction_id",
  })
  transaction: Transaction;

  @Column({ type: "integer", name: "line_no" })
  lineNo: number;

  @Column({ type: "uuid", name: "purpose_id", nullable: true })
  purposeId: string | null;

  @Column({ type: "uuid", name: "purpose_slab_id", nullable: true })
  purposeSlabId: string | null;

  @Column({ type: "numeric", name: "base_amount", precision: 18, scale: 2, default: 0 })
  baseAmount: string;

  @Column({ type: "numeric", name: "rate_percent", precision: 18, scale: 4, default: 0 })
  ratePercent: string;

  @Column({
    type: "enum",
    enum: PurposeRateType,
    enumName: "purpose_rate_type_enum",
    name: "rate_type",
    default: PurposeRateType.PERCENT,
  })
  rateType: PurposeRateType;

  @Column({ type: "numeric", name: "tcs_amount", precision: 18, scale: 2, default: 0 })
  tcsAmount: string;
}
