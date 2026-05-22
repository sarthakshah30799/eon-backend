// branch.entity.ts
import { Entity, Column, Index } from "typeorm";
import { BaseEntity } from "../base/base.entity";

@Entity("branches")
export class Branch extends BaseEntity {
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
