import { Column, Entity, Index, OneToMany } from "typeorm";
import { BaseEntity } from "../base/base.entity";
import { ManyToOne, JoinColumn } from "typeorm";
import { SelectOption } from "../category-options/category-option.entity";
import { FinancialSubProfile } from "../financial-sub-profiles/financial-sub-profile.entity";

@Entity("financial_codes")
export class FinancialCode extends BaseEntity {
  @ManyToOne(() => SelectOption, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({
    name: "financialType",
    foreignKeyConstraintName: "FK_financial_codes_financialType",
  })
  financialType: SelectOption;

  @Index({ unique: true })
  @Column({ type: "citext" })
  financialCode: string;

  @Column({ type: "citext" })
  financialName: string;

  @ManyToOne(() => SelectOption, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({
    name: "defaultSign",
    foreignKeyConstraintName: "FK_financial_codes_defaultSign",
  })
  defaultSign: SelectOption;

  @Column({ type: "int", default: 0 })
  priority: number;

  @OneToMany(() => FinancialSubProfile, (sub) => sub.financialCode, {
    cascade: true,
  })
  subProfiles: FinancialSubProfile[];
}
