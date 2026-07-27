import { Column, Entity, OneToMany, Index, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntity } from "../base/base.entity";
import { State } from "../state/state.entity";
import { CountryGroup } from "../country-groups/country-group.entity";
import { User } from "../users/user.entity";
import { UnblockCountryAccess } from "./entities/unblock-country-access.entity";

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

  @OneToMany(() => UnblockCountryAccess, rule => rule.country)
  unblockCountryAccessRules: UnblockCountryAccess[];

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

  @Column({ type: "boolean", name: "is_blocked", default: false })
  isBlocked: boolean;

  @Column({ type: "timestamptz", name: "blocked_at", nullable: true })
  blockedAt: Date | null;

  @Column({ type: "uuid", name: "blocked_by_id", nullable: true })
  blockedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "blocked_by_id",
    foreignKeyConstraintName: "FK_countries_blocked_by_id",
  })
  blockedBy: User | null;

  @Column({ type: "text", name: "blocked_reason", nullable: true })
  blockedReason: string | null;
}
