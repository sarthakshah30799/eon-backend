import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../base/base.entity";
import { FinancialCode } from "../financial-codes/financial-code.entity";

@Entity("financial_sub_profiles")
export class FinancialSubProfile extends BaseEntity {
  @ManyToOne(() => FinancialCode, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "financial_code_id" })
  financialCode: FinancialCode;

  @Column({ type: "citext" })
  financialSubCode: string;

  @Column({ type: "citext" })
  financialSubName: string;

  @Column({ type: "int", default: 0 })
  priority: number;
}
