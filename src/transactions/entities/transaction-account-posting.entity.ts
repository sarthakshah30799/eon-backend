import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { Transaction } from "./transaction.entity";
import {
  TransactionPostingDirection,
  TransactionPostingSourceType,
} from "../transactions.enums";
import { TransactionReferenceSnapshotValue } from "../types/transaction-snapshot.types";

@Index("IDX_transaction_account_postings_transaction_id", ["transactionId"])
@Index("IDX_transaction_account_postings_transaction_line", ["transactionId", "lineNo"], {
  unique: true,
})
@Index("IDX_transaction_account_postings_account_id", ["accountId"])
@Index("IDX_transaction_account_postings_profile_id", ["profileId"])
@Entity("transaction_account_postings")
export class TransactionAccountPosting extends BaseEntity {
  @Column({ type: "uuid", name: "transaction_id" })
  transactionId: string;

  @ManyToOne(() => Transaction, (transaction) => transaction.postings, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "transaction_id",
    foreignKeyConstraintName: "FK_transaction_account_postings_transaction_id",
  })
  transaction: Transaction;

  @Column({ type: "integer", name: "line_no" })
  lineNo: number;

  @Column({
    type: "enum",
    enum: TransactionPostingSourceType,
    enumName: "posting_source_type",
    name: "source_type",
  })
  sourceType: TransactionPostingSourceType;

  @Column({ type: "uuid", name: "source_id", nullable: true })
  sourceId: string | null;

  @Column({ type: "uuid", name: "account_id" })
  accountId: string;

  @Column({ type: "jsonb", name: "account_snapshot", nullable: true })
  accountSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "profile_id", nullable: true })
  profileId: string | null;

  @Column({
    type: "enum",
    enum: TransactionPostingDirection,
    enumName: "transaction_account_postings_direction_enum",
    name: "direction",
  })
  direction: TransactionPostingDirection;

  @Column({ type: "numeric", precision: 18, scale: 2 })
  amount: string;

  @Column({ type: "text", nullable: true })
  remarks: string | null;
}
