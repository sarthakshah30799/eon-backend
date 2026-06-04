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
import { Country } from "../country/country.entity";
import { State } from "../state/state.entity";

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

  @Index()
  @ManyToOne(() => Country, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "country_id" })
  country: Country;

  @Index()
  @ManyToOne(() => State, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "state_id" })
  state: State;

  @Column({ type: "citext", unique: true })
  code: string;

  @Column({ type: "citext" })
  name: string;

  @Column({ type: "int", unique: true })
  branchNumber: number;

  @Column({ type: "citext" })
  address1: string;

  @Column({ type: "citext", nullable: true })
  address2: string;

  @Column({ type: "citext", nullable: true })
  address3: string;

  @Column({ type: "citext" })
  city: string;

  @Column({ type: "citext", nullable: true })
  gstState: string;

  @Column({ type: "text" })
  pinCode: string;

  @Column({ type: "citext", nullable: true })
  gstNo: string;

  @Column({ type: "citext", nullable: true })
  fxRegNo: string;

  @Column({ type: "timestamp with time zone", nullable: true })
  fxRegDate: Date;

  @Column({ type: "citext", nullable: true })
  contactName: string;

  @Column({ type: "citext", nullable: true })
  contactNo: string;

  @Column({ type: "citext", nullable: true })
  branchEmail: string;

  @Column({ type: "citext", nullable: true })
  aeonBranchLic: string;

  @Column({ type: "citext", nullable: true })
  locationType: string;

  @Column({ type: "numeric", precision: 15, scale: 2, nullable: true })
  cashHolding: number;

  @Column({ type: "numeric", precision: 15, scale: 2, nullable: true })
  cashHoldingTemp: number;

  @Column({ type: "numeric", precision: 15, scale: 2, nullable: true })
  currHolding: number;

  @Column({ type: "numeric", precision: 15, scale: 2, nullable: true })
  currHoldingTemp: number;

  @Column({ type: "boolean", default: false })
  isHeadOffice: boolean;

  @Column({ type: "boolean", default: true })
  isActive: boolean;
}
