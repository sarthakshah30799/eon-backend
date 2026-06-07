import { Column, Entity, OneToMany } from "typeorm";
import { BaseEntity } from "../base/base.entity";
import { Country } from "../country/country.entity";

@Entity("country_groups")
export class CountryGroup extends BaseEntity {
  @Column({ type: "citext", unique: true })
  code: string;

  @Column({ type: "citext", unique: true })
  name: string;

  @OneToMany(() => Country, (country) => country.countryGroup)
  countries: Country[];
}
