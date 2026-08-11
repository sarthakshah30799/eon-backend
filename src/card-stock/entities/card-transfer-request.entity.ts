import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../base/base.entity';
import { CardTransferStatus } from '../card-stock.enums';
import { CardTransferRequestItem } from './card-transfer-request-item.entity';

@Index('IDX_card_transfer_requests_transaction_number', ['transactionNumber'], { unique: true })
@Index('IDX_card_transfer_requests_status', ['status'])
@Index('IDX_card_transfer_requests_source_branch', ['sourceBranchId'])
@Index('IDX_card_transfer_requests_destination_branch', ['destinationBranchId'])
@Entity('card_transfer_requests')
export class CardTransferRequest extends BaseEntity {
  @Column({ type: 'citext', name: 'transaction_number' })
  transactionNumber: string;

  @Column({ type: 'date', name: 'transaction_date' })
  transactionDate: string;

  @Column({ type: 'uuid', name: 'source_branch_id' })
  sourceBranchId: string;

  @Column({ type: 'jsonb', name: 'source_branch_snapshot' })
  sourceBranchSnapshot: Record<string, unknown>;

  @Column({ type: 'uuid', name: 'destination_branch_id' })
  destinationBranchId: string;

  @Column({ type: 'jsonb', name: 'destination_branch_snapshot' })
  destinationBranchSnapshot: Record<string, unknown>;

  @Column({ type: 'enum', enum: CardTransferStatus, default: CardTransferStatus.HELD })
  status: CardTransferStatus;

  @Column({ type: 'numeric', precision: 18, scale: 2, name: 'total_fe_amount' })
  totalFeAmount: string;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ type: 'timestamptz', name: 'held_at', nullable: true })
  heldAt: Date | null;

  @Column({ type: 'timestamptz', name: 'accepted_at', nullable: true })
  acceptedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'rejected_at', nullable: true })
  rejectedAt: Date | null;

  @Column({ type: 'uuid', name: 'held_by_id', nullable: true })
  heldById: string | null;

  @Column({ type: 'uuid', name: 'accepted_by_id', nullable: true })
  acceptedById: string | null;

  @Column({ type: 'uuid', name: 'rejected_by_id', nullable: true })
  rejectedById: string | null;

  @OneToMany(() => CardTransferRequestItem, item => item.transfer, {
    cascade: true,
  })
  items: CardTransferRequestItem[];
}
