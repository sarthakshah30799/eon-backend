import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { TransactionReferenceSnapshotValue } from "../../transactions/types/transaction-snapshot.types";
import { VoucherEntryDirection } from "../../vouchers/voucher.enums";
import { CreditRequestFund } from "./credit-request-fund.entity";

@Entity("credit_request_fund_items")
@Index("UQ_credit_request_fund_items_line", ["creditRequestFundId", "lineNo"], {
  unique: true,
})
@Check("CHK_credit_request_fund_items_amount_positive", `"amount" > 0`)
export class CreditRequestFundItem extends BaseEntity {
  @Column({ type: "uuid", name: "credit_request_fund_id" })
  creditRequestFundId: string;
  @ManyToOne(() => CreditRequestFund, (header) => header.items, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "credit_request_fund_id",
    foreignKeyConstraintName: "FK_credit_request_fund_items_header",
  })
  creditRequestFund: CreditRequestFund;

  @Column({ type: "integer", name: "line_no" }) lineNo: number;
  @Column({ type: "uuid", name: "item_type_option_id" })
  itemTypeOptionId: string;
  @Column({ type: "jsonb", name: "item_type_snapshot" })
  itemTypeSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "subledger_party_profile_id", nullable: true })
  subledgerPartyProfileId: string | null;
  @Column({
    type: "jsonb",
    name: "subledger_party_profile_snapshot",
    nullable: true,
  })
  subledgerPartyProfileSnapshot: TransactionReferenceSnapshotValue | null;

  @Column({ type: "uuid", name: "subledger_branch_id", nullable: true })
  subledgerBranchId: string | null;
  @Column({
    type: "jsonb",
    name: "subledger_branch_snapshot",
    nullable: true,
  })
  subledgerBranchSnapshot: TransactionReferenceSnapshotValue | null;

  @Column({ type: "uuid", name: "account_id" }) accountId: string;
  @Column({ type: "jsonb", name: "account_snapshot" })
  accountSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "enum", enum: VoucherEntryDirection })
  direction: VoucherEntryDirection;
  @Column({ type: "numeric", precision: 18, scale: 2 }) amount: string;
}
