import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from "typeorm";
import { BaseEntity } from "../base/base.entity";
import { Country } from "../country/country.entity";
import { Currency } from "../currencies/currency.entity";

@Entity("country_groups")
export class CountryGroup extends BaseEntity {
  @Column({ type: "citext", unique: true })
  code: string;

  @Column({ type: "citext", unique: true })
  name: string;

  @Column({
    type: "numeric",
    name: "sell_limit_amount",
    precision: 18,
    scale: 2,
    nullable: true,
  })
  sellLimitAmount: string | null;

  @Column({ type: "uuid", name: "sell_limit_currency_id", nullable: true })
  sellLimitCurrencyId: string | null;

  @ManyToOne(() => Currency, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "sell_limit_currency_id",
    foreignKeyConstraintName: "FK_country_groups_sell_limit_currency_id",
  })
  sellLimitCurrency: Currency | null;

  @Column({ type: "integer", name: "min_travel_days", nullable: true })
  minTravelDays: number | null;

  @Column({ type: "integer", name: "max_travel_days", nullable: true })
  maxTravelDays: number | null;

  @OneToMany(() => Country, (country) => country.countryGroup)
  countries: Country[];
}
