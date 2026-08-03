import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../base/base.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { TransferRequestItem } from './transfer-request-item.entity';
import {
  TransferRequestStatus,
  TransferRequestType,
} from '../transfers.enums';
import { TransactionReferenceSnapshotValue } from '../../transactions/types/transaction-snapshot.types';
import { Branch } from '../../branches/branch.entity';
import { Counter } from '../../counters/counter.entity';

@Index('IDX_transfer_requests_number', ['number'], { unique: true })
@Index('IDX_transfer_requests_status', ['status'])
@Index('IDX_transfer_requests_type', ['transferType'])
@Index('IDX_transfer_requests_source_branch', ['sourceBranchId'])
@Index('IDX_transfer_requests_source_counter', ['sourceCounterId'])
@Index('IDX_transfer_requests_destination_branch', ['destinationBranchId'])
@Index('IDX_transfer_requests_destination_counter', ['destinationCounterId'])
@Index('IDX_transfer_requests_source_transaction_id', ['sourceTransactionId'])
@Index('IDX_transfer_requests_destination_transaction_id', ['destinationTransactionId'])
@Entity('transfer_requests')
export class TransferRequest extends BaseEntity {
  @Column({ type: 'citext', nullable: true })
  number: string | null;

  @Column({
    type: 'enum',
    enum: TransferRequestType,
    name: 'transfer_type',
  })
  transferType: TransferRequestType;

  @Column({
    type: 'enum',
    enum: TransferRequestStatus,
    default: TransferRequestStatus.HELD,
  })
  status: TransferRequestStatus;

  @Column({ type: 'timestamptz', name: 'transaction_date', nullable: true })
  transactionDate: Date | string | null;

  @Column({ type: 'citext', name: 'bill_reference' })
  billReference: string;

  @Column({ type: 'uuid', name: 'source_branch_id' })
  sourceBranchId: string;

  sourceBranch?: Branch | null;

  @Column({ type: 'jsonb', name: 'source_branch_snapshot', nullable: true })
  sourceBranchSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: 'uuid', name: 'source_counter_id' })
  sourceCounterId: string;

  sourceCounter?: Counter | null;

  @Column({ type: 'jsonb', name: 'source_counter_snapshot', nullable: true })
  sourceCounterSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: 'uuid', name: 'destination_branch_id' })
  destinationBranchId: string;

  destinationBranch?: Branch | null;

  @Column({
    type: 'jsonb',
    name: 'destination_branch_snapshot',
    nullable: true,
  })
  destinationBranchSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: 'uuid', name: 'destination_counter_id' })
  destinationCounterId: string;

  destinationCounter?: Counter | null;

  @Column({
    type: 'jsonb',
    name: 'destination_counter_snapshot',
    nullable: true,
  })
  destinationCounterSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: 'uuid', name: 'source_transaction_id', nullable: true })
  sourceTransactionId: string | null;

  @ManyToOne(() => Transaction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'source_transaction_id',
    foreignKeyConstraintName: 'FK_transfer_requests_source_transaction_id',
  })
  sourceTransaction: Transaction | null;

  @Column({ type: 'uuid', name: 'destination_transaction_id', nullable: true })
  destinationTransactionId: string | null;

  @ManyToOne(() => Transaction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'destination_transaction_id',
    foreignKeyConstraintName: 'FK_transfer_requests_destination_transaction_id',
  })
  destinationTransaction: Transaction | null;

  @Column({ type: 'citext', name: 'source_number_series_code', nullable: true })
  sourceNumberSeriesCode: string | null;

  @Column({
    type: 'citext',
    name: 'destination_number_series_code',
    nullable: true,
  })
  destinationNumberSeriesCode: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ type: 'timestamptz', name: 'held_at', nullable: true })
  heldAt: Date | null;

  @Column({ type: 'timestamptz', name: 'accepted_at', nullable: true })
  acceptedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'rejected_at', nullable: true })
  rejectedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'cancelled_at', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'uuid', name: 'held_by_id', nullable: true })
  heldById: string | null;

  @Column({ type: 'uuid', name: 'accepted_by_id', nullable: true })
  acceptedById: string | null;

  @Column({ type: 'uuid', name: 'rejected_by_id', nullable: true })
  rejectedById: string | null;

  @Column({ type: 'uuid', name: 'cancelled_by_id', nullable: true })
  cancelledById: string | null;

  @OneToMany(() => TransferRequestItem, (item) => item.transfer, {
    cascade: true,
  })
  items: TransferRequestItem[];
}
