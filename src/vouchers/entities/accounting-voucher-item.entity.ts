import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { TransactionReferenceSnapshotValue } from "../../transactions/types/transaction-snapshot.types";
import { VoucherEntryDirection } from "../voucher.enums";
import { AccountingVoucher } from "./accounting-voucher.entity";

@Entity("accounting_voucher_items")
@Index("UQ_accounting_voucher_items_line", ["voucherId", "lineNo"], { unique: true })
@Check("CHK_accounting_voucher_items_amount_positive", `"amount" > 0`)
export class AccountingVoucherItem extends BaseEntity {
  @Column({ type: "uuid", name: "voucher_id" }) voucherId: string;
  @ManyToOne(() => AccountingVoucher, voucher => voucher.items, { onDelete: "CASCADE" })
  @JoinColumn({ name: "voucher_id", foreignKeyConstraintName: "FK_accounting_voucher_items_voucher" }) voucher: AccountingVoucher;
  @Column({ type: "integer", name: "line_no" }) lineNo: number;
  @Column({ type: "uuid", name: "item_type_option_id" }) itemTypeOptionId: string;
  @Column({ type: "jsonb", name: "item_type_snapshot" }) itemTypeSnapshot: TransactionReferenceSnapshotValue;
  @Column({ type: "uuid", name: "subledger_party_profile_id", nullable: true }) subledgerPartyProfileId: string | null;
  @Column({ type: "jsonb", name: "subledger_party_profile_snapshot", nullable: true }) subledgerPartyProfileSnapshot: TransactionReferenceSnapshotValue;
  @Column({ type: "uuid", name: "account_id" }) accountId: string;
  @Column({ type: "jsonb", name: "account_snapshot" }) accountSnapshot: TransactionReferenceSnapshotValue;
  @Column({ type: "enum", enum: VoucherEntryDirection }) direction: VoucherEntryDirection;
  @Column({ type: "numeric", precision: 18, scale: 2 }) amount: string;
}
