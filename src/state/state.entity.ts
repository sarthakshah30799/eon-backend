import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../base/base.entity";
import { Country } from "../country/country.entity";

@Index(["country", "code"], { unique: true })
@Index(["country", "name"], { unique: true })
@Entity("states")
export class State extends BaseEntity {
  @Index()
  @ManyToOne(() => Country, (country) => country.states, {
    nullable: false,
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "country_id" })
  country: Country;

  @Column({ type: "citext" })
  code: string;

  @Column({ type: "citext" })
  name: string;

  @Column({ type: "citext", nullable: true })
  gstStateCode: string;

  @Column({ type: "citext", nullable: true })
  ctrStateCode: string;
}
