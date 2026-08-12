import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../base/base.entity';
import { CardStockCard } from './card-stock-card.entity';
import { TransactionReferenceSnapshotValue } from '../../transactions/types/transaction-snapshot.types';

@Index('IDX_card_stock_balance_card_branch_active', ['cardId', 'branchId', 'isActive'])
@Index('IDX_card_stock_balance_branch_series', ['branchId', 'series'])
@Entity('card_stock_balance')
export class CardStockBalance extends BaseEntity {
  @Column({ type: 'uuid', name: 'card_id' })
  cardId: string;

  @ManyToOne(() => CardStockCard, card => card.balances, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'card_id', foreignKeyConstraintName: 'FK_card_stock_balance_card' })
  card: CardStockCard;

  @Column({ type: 'uuid', name: 'branch_id' })
  branchId: string;

  @Column({ type: 'jsonb', name: 'branch_snapshot' })
  branchSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: 'uuid', name: 'currency_id' })
  currencyId: string;

  @Column({ type: 'jsonb', name: 'currency_snapshot' })
  currencySnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: 'uuid', name: 'product_id' })
  productId: string;

  @Column({ type: 'jsonb', name: 'product_snapshot' })
  productSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: 'uuid', name: 'issuer_party_profile_id' })
  issuerPartyProfileId: string;

  @Column({ type: 'jsonb', name: 'issuer_party_profile_snapshot' })
  issuerPartyProfileSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: 'citext' })
  series: string;

  @Column({ type: 'timestamptz', name: 'receive_date', nullable: true })
  receiveDate: Date | null;

  @Column({ type: 'numeric', name: 'receive_rate', precision: 18, scale: 7, default: 0 })
  receiveRate: string;

  @Column({ type: 'numeric', name: 'receive_amount', precision: 18, scale: 2, default: 0 })
  receiveAmount: string;

  @Column({ type: 'uuid', name: 'receive_transaction_id', nullable: true })
  receiveTransactionId: string | null;

  @Column({ type: 'timestamptz', name: 'transfer_date', nullable: true })
  transferDate: Date | null;

  @Column({ type: 'numeric', name: 'transfer_rate', precision: 18, scale: 7, default: 0 })
  transferRate: string;

  @Column({ type: 'numeric', name: 'transfer_amount', precision: 18, scale: 2, default: 0 })
  transferAmount: string;

  @Column({ type: 'uuid', name: 'transfer_transaction_id', nullable: true })
  transferTransactionId: string | null;

  @Column({ type: 'timestamptz', name: 'sell_date', nullable: true })
  sellDate: Date | null;

  @Column({ type: 'numeric', name: 'sell_rate', precision: 18, scale: 7, default: 0 })
  sellRate: string;

  @Column({ type: 'numeric', name: 'sell_amount', precision: 18, scale: 2, default: 0 })
  sellAmount: string;

  @Column({ type: 'uuid', name: 'sell_transaction_id', nullable: true })
  sellTransactionId: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;
}
