import { Column, Entity, Index, OneToMany } from "typeorm";
import { BaseEntity } from "../base/base.entity";
import { FinancialSubProfile } from "../financial-sub-profiles/financial-sub-profile.entity";

@Entity("financial_codes")
export class FinancialCode extends BaseEntity {
  @Column({ type: "citext" })
  financialType: string;

  @Index({ unique: true })
  @Column({ type: "citext" })
  financialCode: string;

  @Column({ type: "citext" })
  financialName: string;

  @Column({ type: "citext" })
  defaultSign: string;

  @Column({ type: "int", default: 0 })
  priority: number;

  @OneToMany(() => FinancialSubProfile, (sub) => sub.financialCode, {
    cascade: true,
  })
  subProfiles: FinancialSubProfile[];
}
