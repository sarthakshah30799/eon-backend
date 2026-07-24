import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../base/base.entity";
import { Passenger } from "./passenger.entity";
import { Country } from "../country/country.entity";
import { SelectOption } from "../category-options/category-option.entity";

@Index("IDX_passenger_travels_passenger_id", ["passengerId"])
@Index("IDX_passenger_travels_country_id", ["travellingCountryId"])
@Index("IDX_passenger_travels_ticket_no", ["ticketNo"])
@Index("IDX_passenger_travels_travel_pnr", ["travelPnr"])
@Entity("passenger_travels")
export class PassengerTravel extends BaseEntity {
  @Column({ type: "uuid", name: "passenger_id" })
  passengerId: string;

  @ManyToOne(() => Passenger, (passenger) => passenger.travels, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "passenger_id",
    foreignKeyConstraintName: "FK_passenger_travels_passenger_id",
  })
  passenger: Passenger;

  @Column({ type: "uuid", name: "airline_tt_id", nullable: true })
  airlineTtId: string | null;

  @ManyToOne(() => SelectOption, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "airline_tt_id",
    foreignKeyConstraintName: "FK_passenger_travels_airline_tt_id",
  })
  airlineTt: SelectOption | null;

  @Column({ type: "citext", name: "ticket_no", nullable: true })
  ticketNo: string | null;

  @Column({ type: "citext", name: "route", nullable: true })
  route: string | null;

  @Column({ type: "uuid", name: "travelling_country_id", nullable: true })
  travellingCountryId: string | null;

  @ManyToOne(() => Country, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "travelling_country_id",
    foreignKeyConstraintName: "FK_passenger_travels_travelling_country_id",
  })
  travellingCountry: Country | null;

  @Column({ type: "integer", name: "no_of_days", nullable: true })
  noOfDays: number | null;

  @Column({ type: "integer", name: "no_of_pax", nullable: true })
  noOfPax: number | null;

  @Column({ type: "date", name: "departure_date", nullable: true })
  departureDate: string | null;

  @Column({ type: "citext", name: "travel_pnr", nullable: true })
  travelPnr: string | null;

  @Column({ type: "boolean", default: false })
  visa: boolean;

  @Column({ type: "boolean", name: "is_cis_country", default: false })
  isCisCountry: boolean;
}
