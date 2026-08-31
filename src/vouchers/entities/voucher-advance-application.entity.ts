import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
} from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { Transaction } from "../../transactions/entities/transaction.entity";
import { TransactionPayment } from "../../transactions/entities/transaction-payment.entity";
import { VoucherAdvanceApplicationState } from "../voucher.enums";
import { AccountingVoucher } from "./accounting-voucher.entity";

@Entity("voucher_advance_applications")
@Index("UQ_voucher_advance_transaction", ["voucherId", "transactionId"], {
  unique: true,
})
@Index("UQ_voucher_advance_payment", ["transactionPaymentId"], { unique: true })
@Index("IDX_voucher_advance_balance", ["voucherId", "state"])
@Check("CHK_voucher_advance_amount_positive", `"amount" > 0`)
export class VoucherAdvanceApplication extends BaseEntity {
  @Column({ type: "uuid", name: "voucher_id" }) voucherId: string;
  @ManyToOne(() => AccountingVoucher, (voucher) => voucher.applications, {
    onDelete: "RESTRICT",
  })
  @JoinColumn({
    name: "voucher_id",
    foreignKeyConstraintName: "FK_voucher_advance_applications_voucher",
  })
  voucher: AccountingVoucher;
  @Column({ type: "uuid", name: "transaction_id" }) transactionId: string;
  @ManyToOne(() => Transaction, { onDelete: "CASCADE" })
  @JoinColumn({
    name: "transaction_id",
    foreignKeyConstraintName: "FK_voucher_advance_applications_transaction",
  })
  transaction: Transaction;
  @Column({ type: "uuid", name: "transaction_payment_id" })
  transactionPaymentId: string;
  @OneToOne(() => TransactionPayment, (payment) => payment.advanceApplication, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "transaction_payment_id",
    foreignKeyConstraintName: "FK_voucher_advance_applications_payment",
  })
  transactionPayment: TransactionPayment;
  @Column({ type: "numeric", precision: 18, scale: 2 }) amount: string;
  @Column({ type: "enum", enum: VoucherAdvanceApplicationState })
  state: VoucherAdvanceApplicationState;
  @Column({ type: "timestamptz", name: "reserved_at", nullable: true })
  reservedAt: Date | null;
  @Column({ type: "timestamptz", name: "applied_at", nullable: true })
  appliedAt: Date | null;
  @Column({ type: "timestamptz", name: "released_at", nullable: true })
  releasedAt: Date | null;
}
