import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../base/base.entity';
import { CardStockCard } from './card-stock-card.entity';
import { TransactionReferenceSnapshotValue } from '../../transactions/types/transaction-snapshot.types';
import { CardStockTransactionEntry } from './card-stock-transaction-entry.entity';

@Index('IDX_card_stock_balance_card_branch_active', ['cardId', 'branchId', 'isActive'])
@Index('IDX_card_stock_balance_branch_series', ['branchId', 'series'])
@Index('UQ_card_stock_balance_active_card_branch', ['cardId', 'branchId'], { unique: true, where: '"is_active" = true' })
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

  @Column({ type: 'uuid', name: 'receive_entry_id', nullable: true })
  receiveEntryId: string | null;

  @ManyToOne(() => CardStockTransactionEntry, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'receive_entry_id', foreignKeyConstraintName: 'FK_card_stock_balance_receive_entry' })
  receiveEntry: CardStockTransactionEntry | null;

  @Column({ type: 'timestamptz', name: 'transfer_date', nullable: true })
  transferDate: Date | null;

  @Column({ type: 'numeric', name: 'transfer_rate', precision: 18, scale: 7, default: 0 })
  transferRate: string;

  @Column({ type: 'numeric', name: 'transfer_amount', precision: 18, scale: 2, default: 0 })
  transferAmount: string;

  @Column({ type: 'uuid', name: 'transfer_entry_id', nullable: true })
  transferEntryId: string | null;

  @ManyToOne(() => CardStockTransactionEntry, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'transfer_entry_id', foreignKeyConstraintName: 'FK_card_stock_balance_transfer_entry' })
  transferEntry: CardStockTransactionEntry | null;

  @Column({ type: 'timestamptz', name: 'sell_date', nullable: true })
  sellDate: Date | null;

  @Column({ type: 'numeric', name: 'sell_rate', precision: 18, scale: 7, default: 0 })
  sellRate: string;

  @Column({ type: 'numeric', name: 'sell_amount', precision: 18, scale: 2, default: 0 })
  sellAmount: string;

  @Column({ type: 'uuid', name: 'sell_entry_id', nullable: true })
  sellEntryId: string | null;

  @ManyToOne(() => CardStockTransactionEntry, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'sell_entry_id', foreignKeyConstraintName: 'FK_card_stock_balance_sell_entry' })
  sellEntry: CardStockTransactionEntry | null;

  @Column({ type: 'timestamptz', name: 'settle_date', nullable: true })
  settleDate: Date | null;

  @Column({ type: 'numeric', name: 'settle_rate', precision: 18, scale: 7, default: 0 })
  settleRate: string;

  @Column({ type: 'numeric', name: 'settle_amount', precision: 18, scale: 2, default: 0 })
  settleAmount: string;

  @Column({ type: 'uuid', name: 'settle_entry_id', nullable: true })
  settleEntryId: string | null;

  @ManyToOne(() => CardStockTransactionEntry, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'settle_entry_id', foreignKeyConstraintName: 'FK_card_stock_balance_settle_entry' })
  settleEntry: CardStockTransactionEntry | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;
}
