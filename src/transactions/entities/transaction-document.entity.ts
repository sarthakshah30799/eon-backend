import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import {
  TransactionDocumentStatus,
} from "../transactions.enums";
import { Transaction } from "./transaction.entity";
import { TransactionReferenceSnapshotValue } from "../types/transaction-snapshot.types";

@Index("IDX_transaction_documents_transaction_id", ["transactionId"])
@Index("IDX_transaction_documents_transaction_line", ["transactionId", "lineNo"], {
  unique: true,
})
@Entity("transaction_documents")
export class TransactionDocument extends BaseEntity {
  @Column({ type: "uuid", name: "transaction_id" })
  transactionId: string;

  @ManyToOne(() => Transaction, (transaction) => transaction.documents, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "transaction_id",
    foreignKeyConstraintName: "FK_transaction_documents_transaction_id",
  })
  transaction: Transaction;

  @Column({ type: "integer", name: "line_no" })
  lineNo: number;

  @Column({ type: "uuid", name: "document_profile_id" })
  documentProfileId: string;

  @Column({
    type: "jsonb",
    name: "document_profile_snapshot",
    nullable: true,
  })
  documentProfileSnapshot: TransactionReferenceSnapshotValue;

  @Column({
    type: "enum",
    enum: TransactionDocumentStatus,
    enumName: "transaction_documents_status_enum",
    default: TransactionDocumentStatus.PENDING,
  })
  status: TransactionDocumentStatus;

  @Column({ type: "varchar", length: 255, name: "file_name", nullable: true })
  fileName: string | null;

  @Column({
    type: "varchar",
    length: 255,
    name: "original_file_name",
    nullable: true,
  })
  originalFileName: string | null;

  @Column({ type: "varchar", length: 150, name: "mime_type", nullable: true })
  mimeType: string | null;

  @Column({ type: "bigint", name: "file_size", nullable: true })
  fileSize: string | null;

  @Column({ type: "text", name: "storage_key", nullable: true })
  storageKey: string | null;

  @Column({ type: "text", name: "storage_path", nullable: true })
  storagePath: string | null;

  @Column({ type: "text", name: "storage_url", nullable: true })
  storageUrl: string | null;

  @Column({ type: "text", nullable: true })
  remarks: string | null;
}
