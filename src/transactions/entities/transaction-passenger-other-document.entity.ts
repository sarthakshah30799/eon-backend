import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import {
  PassengerOtherIdProofType,
} from "../../passengers/passenger.entity";
import { Transaction } from "./transaction.entity";

@Index("IDX_transaction_passenger_other_documents_transaction_id", ["transactionId"])
@Index(
  "IDX_transaction_passenger_other_documents_transaction_line_no",
  ["transactionId", "lineNo"],
  {
    unique: true,
  }
)
@Index(
  "IDX_transaction_passenger_other_documents_document_number",
  ["documentNumber"]
)
@Check(
  "CHK_transaction_passenger_other_documents_document_number_present",
  `"document_number" IS NOT NULL`
)
@Check(
  "CHK_transaction_passenger_other_documents_date_order",
  `"issue_date" IS NULL OR "expiry_date" IS NULL OR "expiry_date" >= "issue_date"`
)
@Entity("transaction_passenger_other_documents")
export class TransactionPassengerOtherDocument extends BaseEntity {
  @Column({ type: "uuid", name: "transaction_id" })
  transactionId: string;

  @ManyToOne(() => Transaction, (transaction) => transaction.passengerOtherDocuments, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "transaction_id",
    foreignKeyConstraintName: "FK_transaction_passenger_other_documents_transaction_id",
  })
  transaction: Transaction;

  @Column({ type: "integer", name: "line_no" })
  lineNo: number;

  @Column({
    type: "enum",
    enum: PassengerOtherIdProofType,
    enumName: "transaction_passenger_other_documents_document_type_enum",
    name: "document_type",
  })
  documentType: PassengerOtherIdProofType;

  @Column({ type: "citext", name: "document_number" })
  documentNumber: string;

  @Column({ type: "date", name: "valid_till", nullable: true })
  validTill: string | null;

  @Column({ type: "citext", name: "issue_at", nullable: true })
  issueAt: string | null;

  @Column({ type: "date", name: "issue_date", nullable: true })
  issueDate: string | null;

  @Column({ type: "date", name: "expiry_date", nullable: true })
  expiryDate: string | null;

  @Column({ type: "text", name: "file_name", nullable: true })
  fileName: string | null;

  @Column({ type: "text", name: "original_file_name", nullable: true })
  originalFileName: string | null;

  @Column({ type: "text", name: "mime_type", nullable: true })
  mimeType: string | null;

  @Column({ type: "bigint", name: "file_size", nullable: true })
  fileSize: string | null;

  @Column({ type: "text", name: "storage_key", nullable: true })
  storageKey: string | null;

  @Column({ type: "text", name: "storage_path", nullable: true })
  storagePath: string | null;

  @Column({ type: "text", name: "storage_url", nullable: true })
  storageUrl: string | null;

  @Column({ type: "bytea", nullable: true })
  content: Buffer | null;

  @Column({ type: "text", nullable: true })
  remarks: string | null;
}
