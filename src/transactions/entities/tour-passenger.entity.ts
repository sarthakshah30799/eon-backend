import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { Transaction } from "./transaction.entity";

@Index("IDX_tour_passengers_transaction_id", ["transactionId"])
@Index("IDX_tour_passengers_passenger_id", ["passengerId"])
@Index("IDX_tour_passengers_transaction_line", ["transactionId", "lineNo"], {
  unique: true,
})
@Entity("tour_passengers")
export class TourPassenger extends BaseEntity {
  @Column({ type: "uuid", name: "transaction_id" })
  transactionId: string;

  @ManyToOne(() => Transaction, (transaction) => transaction.tourPassengers, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "transaction_id",
    foreignKeyConstraintName: "FK_tour_passengers_transaction_id",
  })
  transaction: Transaction;

  @Column({ type: "uuid", name: "passenger_id" })
  passengerId: string;

  @Column({ type: "integer", name: "line_no" })
  lineNo: number;

  @Column({ type: "citext", name: "passport_number", nullable: true })
  passportNumber: string | null;

  @Column({ type: "citext", name: "passport_name", nullable: true })
  passportName: string | null;

  @Column({ type: "citext", name: "place_of_issue", nullable: true })
  placeOfIssue: string | null;

  @Column({ type: "date", name: "date_of_issue", nullable: true })
  dateOfIssue: string | null;

  @Column({ type: "date", name: "date_of_expiry", nullable: true })
  dateOfExpiry: string | null;

  @Column({ type: "citext", name: "pan_holder_relationship", nullable: true })
  panHolderRelationship: string | null;

  @Column({ type: "citext", name: "traveller_pan_number", nullable: true })
  travellerPanNumber: string | null;

  @Column({ type: "citext", name: "pan_name", nullable: true })
  panName: string | null;

  @Column({ type: "date", name: "traveller_dob", nullable: true })
  travellerDob: string | null;

  @Column({ type: "citext", name: "fcn_code", nullable: true })
  fcnCode: string | null;

  @Column({
    type: "numeric",
    name: "fcn_amount",
    precision: 18,
    scale: 7,
    nullable: true,
  })
  fcnAmount: string | null;

  @Column({ type: "text", name: "contact_no", nullable: true })
  contactNo: string | null;

  @Column({ type: "text", nullable: true })
  remark: string | null;

  @Column({ type: "date", name: "other_ad_exchange_date", nullable: true })
  otherAdExchangeDate: string | null;

  @Column({ type: "text", name: "other_ad_name_address", nullable: true })
  otherAdNameAddress: string | null;
}
