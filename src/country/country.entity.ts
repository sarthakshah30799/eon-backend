import { Column, Entity } from "typeorm";
import { BaseEntity } from "../base/base.entity";

export enum CountryRiskCategory {
  Low = "low",
  Medium = "medium",
  High = "high",
}

@Entity("countries")
export class Country extends BaseEntity {
  @Column({ type: "citext", unique: true })
  code: string;

  @Column({ type: "citext" })
  name: string;

  @Column({ type: "citext", nullable: true })
  lrsCode: string;

  @Column({ type: "citext", nullable: true })
  ctrCode: string;

  @Column({
    type: "enum",
    enum: CountryRiskCategory,
    default: CountryRiskCategory.Low,
  })
  riskCategory: CountryRiskCategory;

  @Column({ type: "boolean", default: false })
  isRestricted: boolean;

  @Column({ type: "boolean", default: false })
  isGreyList: boolean;

  @Column({ type: "boolean", default: false })
  isBase: boolean;
}
