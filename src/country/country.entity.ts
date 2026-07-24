import { Column, Entity, OneToMany, Index, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntity } from "../base/base.entity";
import { State } from "../state/state.entity";
import { CountryGroup } from "../country-groups/country-group.entity";

export enum CountryRiskCategory {
  Low = "low",
  Medium = "medium",
  High = "high",
}

@Entity("countries")
export class Country extends BaseEntity {
  @Column({ type: "citext", unique: true })
  code: string;

  @Index({ unique: true })
  @Column({ type: "citext" })
  name: string;

  @ManyToOne(() => CountryGroup, (group) => group.countries, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "country_group_id" })
  countryGroup: CountryGroup;

  @OneToMany(() => State, (state) => state.country)
  states: State[];

  @Column({ type: "citext", nullable: true })
  lrsCountryCode: string;

  @Column({ type: "citext", nullable: true })
  ctrCountryCode: string;

  @Column({
    type: "enum",
    enum: CountryRiskCategory,
    default: CountryRiskCategory.Low,
  })
  riskCategory: CountryRiskCategory;

  @Column({ type: "boolean", default: false })
  restrictedCountry: boolean;

  @Column({ type: "boolean", default: false })
  greyListCountry: boolean;

  @Column({ type: "boolean", default: false })
  baseCountry: boolean;

  @Column({ type: "boolean", name: "is_cis_country", default: false })
  isCisCountry: boolean;
}
