import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { Transaction } from "../../transactions/entities/transaction.entity";
import { TransactionReferenceSnapshotValue } from "../../transactions/types/transaction-snapshot.types";

@Index("UQ_tt_remittance_details_transaction", ["transactionId"], {
  unique: true,
})
@Entity("tt_remittance_details")
export class TtRemittanceDetail extends BaseEntity {
  @Column({ type: "uuid", name: "transaction_id" })
  transactionId: string;

  @ManyToOne(() => Transaction, { onDelete: "RESTRICT" })
  @JoinColumn({
    name: "transaction_id",
    foreignKeyConstraintName: "FK_tt_remittance_details_transaction",
  })
  transaction: Transaction;

  @Column({ type: "citext", name: "remitter_name" })
  remitterName: string;

  @Column({ type: "text", name: "remitter_address", nullable: true })
  remitterAddress: string | null;

  @Column({ type: "citext", name: "remitter_city", nullable: true })
  remitterCity: string | null;

  @Column({ type: "uuid", name: "remitter_country_id", nullable: true })
  remitterCountryId: string | null;

  @Column({ type: "jsonb", name: "remitter_country_snapshot", nullable: true })
  remitterCountrySnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "citext", name: "remitter_entity_type", nullable: true })
  remitterEntityType: string | null;

  @Column({ type: "citext", name: "beneficiary_name" })
  beneficiaryName: string;

  @Column({ type: "text", name: "beneficiary_address", nullable: true })
  beneficiaryAddress: string | null;

  @Column({ type: "uuid", name: "beneficiary_country_id", nullable: true })
  beneficiaryCountryId: string | null;

  @Column({
    type: "jsonb",
    name: "beneficiary_country_snapshot",
    nullable: true,
  })
  beneficiaryCountrySnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "citext", name: "bank_name" })
  bankName: string;

  @Column({ type: "text", name: "bank_address", nullable: true })
  bankAddress: string | null;

  @Column({ type: "citext", name: "account_number", nullable: true })
  accountNumber: string | null;

  @Column({ type: "citext", name: "iban", nullable: true })
  iban: string | null;

  @Column({ type: "citext", name: "swift_code", nullable: true })
  swiftCode: string | null;

  @Column({ type: "citext", name: "bsb_code", nullable: true })
  bsbCode: string | null;

  @Column({ type: "citext", name: "sort_code", nullable: true })
  sortCode: string | null;

  @Column({ type: "citext", name: "routing_number", nullable: true })
  routingNumber: string | null;

  @Column({ type: "citext", name: "transit_number", nullable: true })
  transitNumber: string | null;

  @Column({ type: "text", name: "education_details", nullable: true })
  educationDetails: string | null;

  @Column({ type: "uuid", name: "fb_bearer_option_id", nullable: true })
  fbBearerOptionId: string | null;

  @Column({ type: "jsonb", name: "fb_bearer_option_snapshot", nullable: true })
  fbBearerOptionSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "citext", name: "intermediary_bank_name", nullable: true })
  intermediaryBankName: string | null;

  @Column({ type: "text", name: "intermediary_bank_address", nullable: true })
  intermediaryBankAddress: string | null;

  @Column({ type: "citext", name: "intermediary_bank_codes", nullable: true })
  intermediaryBankCodes: string | null;

  @Column({ type: "text", name: "relationship", nullable: true })
  relationship: string | null;

  @Column({ type: "citext", name: "sponsorship_name", nullable: true })
  sponsorshipName: string | null;

  @Column({ type: "citext", name: "sponsorship_pan", nullable: true })
  sponsorshipPan: string | null;

  @Column({ type: "date", name: "date_of_incorporation", nullable: true })
  dateOfIncorporation: string | null;

  @Column({
    type: "numeric",
    precision: 18,
    scale: 2,
    name: "mice_amount",
    nullable: true,
  })
  miceAmount: string | null;

  @Column({ type: "text", name: "mice_reference", nullable: true })
  miceReference: string | null;
}
