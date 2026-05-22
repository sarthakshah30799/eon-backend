// company.entity.ts
import { Entity, Column } from "typeorm";
import { BaseEntity } from "../base/base.entity";

@Entity("company")
export class Company extends BaseEntity {
  @Column({ type: "citext" })
  name: string;

  @Column({ type: "citext", nullable: true })
  designation: string;

  @Column({ type: "citext", nullable: true })
  rbiName: string;

  @Column({ type: "citext", nullable: true })
  rbiPlace: string;

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
}
