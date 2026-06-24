import { Entity, Column, Index, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntity } from "../base/base.entity";
import { SelectOption } from "../category-options/category-option.entity";
import { Currency } from "../currencies/currency.entity";
import { FinancialCode } from "../financial-codes/financial-code.entity";
import { FinancialSubProfile } from "../financial-sub-profiles/financial-sub-profile.entity";
import { Branch } from "../branches/branch.entity";

@Entity("account_profiles")
export class AccountProfile extends BaseEntity {
  @ManyToOne(() => SelectOption, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    foreignKeyConstraintName: "FK_account_profiles_division_dept",
  })
  divisionDept: SelectOption | null;

  @Index({ unique: true })
  @Column({ type: "citext" })
  accountCode: string;

  @Index({ unique: true })
  @Column({ type: "citext" })
  accountName: string;

  @ManyToOne(() => SelectOption, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    foreignKeyConstraintName: "FK_account_profiles_account_type",
  })
  accountType: SelectOption | null;

  @ManyToOne(() => SelectOption, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    foreignKeyConstraintName: "FK_account_profiles_sub_ledger",
  })
  subLedger: SelectOption | null;

  @ManyToOne(() => SelectOption, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    foreignKeyConstraintName: "FK_account_profiles_bank_nature",
  })
  bankNature: SelectOption | null;

  @ManyToOne(() => Currency, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "currency_id" })
  currency: Currency;

  @Column({ type: "uuid" })
  currencyId: string;

  @ManyToOne(() => FinancialCode, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "financial_code_id" })
  financialCode: FinancialCode;

  @Column({ type: "uuid" })
  financialCodeId: string;

  @ManyToOne(() => FinancialSubProfile, {
    nullable: true,
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "financial_sub_profile_id" })
  financialSubProfile: FinancialSubProfile;

  @Column({ type: "uuid", nullable: true })
  financialSubProfileId: string;

  @Column({ type: "citext", nullable: true })
  pettyCashExpenseId: string;

  @Column({ type: "boolean", default: false })
  zeroBalanceAtEod: boolean;

  @ManyToOne(() => Branch, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "branch_id_to_transfer" })
  branchToTransfer: Branch;

  @Column({ type: "uuid", nullable: true })
  branchIdToTransfer: string;

  @ManyToOne(() => AccountProfile, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "map_to_account_id" })
  mapToAccount: AccountProfile;

  @Column({ type: "uuid", nullable: true })
  mapToAccountId: string;

  @Column({ type: "boolean", default: false })
  doSale: boolean;

  @Column({ type: "boolean", default: false })
  doPurchase: boolean;

  @Column({ type: "boolean", default: false })
  doReceipt: boolean;

  @Column({ type: "boolean", default: false })
  doPayment: boolean;

  @Column({ type: "boolean", default: true })
  active: boolean;

  @Column({ type: "boolean", default: false })
  cmsBank: boolean;

  @Column({ type: "boolean", default: false })
  directRemittance: boolean;
}
