// branch.entity.ts
import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { BaseEntity } from "../base/base.entity";
import { Company } from "../company/company.entity";
import { Counter } from "../counters/counter.entity";

@Entity("branches")
export class Branch extends BaseEntity {
  @OneToMany(() => Counter, (counter) => counter.branch)
  counters: Counter[];

  @Index()
  @ManyToOne(() => Company, (company) => company.branches, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "company_id" })
  company: Company;

  @Column({ type: "citext", unique: true })
  branchCode: string;

  @Column({ type: "int", unique: true })
  branchNumber: number;

  @Column({ type: "citext" })
  address1: string;

  @Column({ type: "citext", nullable: true })
  address2: string;

  @Column({ type: "citext", nullable: true })
  address3: string;

  @Column({ type: "text" })
  pincode: string;

  @Column({ type: "citext" })
  city: string;

  @Column({ type: "citext" })
  state: string;

  @Column({ type: "citext", default: "India" })
  country: string;

  @Index()
  @Column({ type: "char", length: 2 })
  stateCode: string;

  @Index()
  @Column({ type: "text" })
  gstStateCode: string;

  @Column({ type: "char", length: 2, default: "IN" })
  countryCode1: string;

  @Column({ type: "text" })
  phoneNumber1: string;

  @Column({ type: "char", length: 2, default: "IN" })
  countryCode2: string;

  @Column({ type: "text", nullable: true })
  phoneNumber2: string;

  @Column({ type: "citext", nullable: true })
  contactPersonName: string;

  @Column({ type: "char", length: 2, default: "IN" })
  contactPersonCountryCode: string;

  @Column({ type: "text", nullable: true })
  contactPersonPhone: string;

  @Index()
  @Column({ type: "citext", nullable: true })
  operationGroup: string;
}
