import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../base/base.entity";
import { PartyProfile } from "../party-profiles/party-profile.entity";
import { Country } from "../country/country.entity";
import { State } from "../state/state.entity";
import { SelectOption } from "../category-options/category-option.entity";

export enum PassengerEntityType {
  CORPORATE = "CORPORATE",
  INDIVIDUAL = "INDIVIDUAL",
}

export enum PassengerNationalityType {
  INDIAN = "INDIAN",
  NRI = "NRI",
  FOREIGNER = "FOREIGNER",
}

export enum PassengerPanHolderRelationType {
  COMPANY = "COMPANY",
  INDIVIDUAL = "INDIVIDUAL",
}

export enum PassengerOtherIdProofType {
  AADHAAR = "AADHAAR",
  DRIVING_LICENSE = "DRIVING_LICENSE",
  PAN = "PAN",
  VOTER_ID = "VOTER_ID",
}

@Index("IDX_passengers_party_profile_id", ["partyProfileId"])
@Index("IDX_passengers_entity_type", ["entityType"])
@Index("IDX_passengers_nationality_type", ["nationalityType"])
@Index("IDX_passengers_country_id", ["countryId"])
@Index("IDX_passengers_state_id", ["stateId"])
@Index("IDX_passengers_gst_state_id", ["gstStateId"])
@Index("IDX_passengers_pan_number", ["panNumber"], {
  unique: true,
})
@Index("IDX_passengers_corporate_pan_number", ["corporatePanNumber"], {
  unique: true,
})
@Index("IDX_passengers_passport_number", ["passportNumber"], { unique: true })
@Check(
  "CHK_passengers_party_profile_required",
  `"party_profile_id" IS NOT NULL`,
)
@Check("CHK_passengers_country_required", `"country_id" IS NOT NULL`)
@Check(
  "CHK_passengers_passport_date_order",
  `"passport_issue_date" IS NULL OR "passport_expiry_date" IS NULL OR "passport_expiry_date" >= "passport_issue_date"`,
)
@Check(
  "CHK_passengers_pan_holder_present",
  `"pan_number" IS NULL OR "pan_holder_name" IS NOT NULL`,
)
@Check(
  "CHK_passengers_corporate_pan_holder_present",
  `"corporate_pan_number" IS NULL OR "corporate_pan_holder_name" IS NOT NULL`,
)
@Entity("passengers")
export class Passenger extends BaseEntity {
  @Column({ type: "uuid", name: "party_profile_id" })
  partyProfileId: string;

  @ManyToOne(() => PartyProfile, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({
    name: "party_profile_id",
    foreignKeyConstraintName: "FK_passengers_party_profile_id",
  })
  partyProfile: PartyProfile;

  @Column({
    type: "enum",
    enum: PassengerEntityType,
  })
  entityType: PassengerEntityType;

  @Column({
    type: "enum",
    enum: PassengerNationalityType,
  })
  nationalityType: PassengerNationalityType;

  @Column({ type: "uuid", name: "country_id" })
  countryId: string;

  @ManyToOne(() => Country, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({
    name: "country_id",
    foreignKeyConstraintName: "FK_passengers_country_id",
  })
  country: Country;

  @Column({ type: "uuid", name: "resident_status_id", nullable: true })
  residentStatusId: string | null;

  @ManyToOne(() => SelectOption, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "resident_status_id",
    foreignKeyConstraintName: "FK_passengers_resident_status_id",
  })
  residentStatus: SelectOption | null;

  @Column({ type: "uuid", name: "location_id", nullable: true })
  locationId: string | null;

  @ManyToOne(() => SelectOption, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "location_id",
    foreignKeyConstraintName: "FK_passengers_location_id",
  })
  location: SelectOption | null;

  @Column({ type: "citext", name: "email", nullable: true })
  email: string | null;

  @Column({ type: "citext", name: "contact_no", nullable: true })
  contactNo: string | null;

  @Column({ type: "citext", name: "pan_number", nullable: true })
  panNumber: string | null;

  @Column({
    type: "citext",
    name: "pan_holder_name",
    nullable: true,
  })
  panHolderName: string | null;

  @Column({ type: "date", name: "pan_dob", nullable: true })
  panDob: string | null;

  @Column({
    type: "enum",
    enum: PassengerPanHolderRelationType,
    nullable: true,
  })
  panHolderRelationType: PassengerPanHolderRelationType | null;

  @Column({ type: "citext", name: "paid_by_pan_number", nullable: true })
  paidByPanNumber: string | null;

  @Column({
    type: "citext",
    name: "paid_by_pan_holder_name",
    nullable: true,
  })
  paidByPanHolderName: string | null;

  @Column({ type: "date", name: "paid_by_pan_dob", nullable: true })
  paidByPanDob: string | null;

  @Column({ type: "citext", name: "corporate_pan_number", nullable: true })
  corporatePanNumber: string | null;

  @Column({
    type: "citext",
    name: "corporate_pan_holder_name",
    nullable: true,
  })
  corporatePanHolderName: string | null;

  @Column({ type: "date", name: "corporate_pan_dob", nullable: true })
  corporatePanDob: string | null;

  @Column({
    type: "enum",
    enum: PassengerPanHolderRelationType,
    nullable: true,
  })
  corporatePanHolderRelationType: PassengerPanHolderRelationType | null;

  @Column({ type: "uuid", name: "gst_state_id", nullable: true })
  gstStateId: string | null;

  @ManyToOne(() => State, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "gst_state_id",
    foreignKeyConstraintName: "FK_passengers_gst_state_id",
  })
  gstState: State | null;

  @Column({ type: "citext", name: "gst_number", nullable: true })
  gstNumber: string | null;

  @Column({ type: "citext", name: "address_1", nullable: true })
  address1: string | null;

  @Column({ type: "citext", name: "address_2", nullable: true })
  address2: string | null;

  @Column({ type: "citext", name: "city", nullable: true })
  city: string | null;

  @Column({ type: "uuid", name: "state_id", nullable: true })
  stateId: string | null;

  @ManyToOne(() => State, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "state_id",
    foreignKeyConstraintName: "FK_passengers_state_id",
  })
  state: State | null;

  @Column({ type: "citext", name: "passport_number", nullable: true })
  passportNumber: string | null;

  @Column({ type: "citext", name: "passport_issue_at", nullable: true })
  passportIssueAt: string | null;

  @Column({ type: "date", name: "passport_issue_date", nullable: true })
  passportIssueDate: string | null;

  @Column({ type: "date", name: "passport_expiry_date", nullable: true })
  passportExpiryDate: string | null;

  @Column({ type: "date", name: "arrival_date", nullable: true })
  arrivalDate: string | null;

  @Column({ type: "boolean", name: "is_pep", default: false })
  isPep: boolean;

  @Column({ type: "text", name: "remarks", nullable: true })
  remarks: string | null;
}
