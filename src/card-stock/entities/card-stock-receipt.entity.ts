import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../base/base.entity';
import { CardStockReceiptStatus } from '../card-stock.enums';
import { CardStockReceiptItem } from './card-stock-receipt-item.entity';

@Index('IDX_card_stock_receipts_transaction_number', ['transactionNumber'], { unique: true })
@Index('IDX_card_stock_receipts_date', ['receiptDate'])
@Entity('card_stock_receipts')
export class CardStockReceipt extends BaseEntity {
  @Column({ type: 'citext', name: 'transaction_number' })
  transactionNumber: string;

  @Column({ type: 'date', name: 'receipt_date' })
  receiptDate: string;

  @Column({ type: 'uuid', name: 'ho_branch_id' })
  hoBranchId: string;

  @Column({ type: 'jsonb', name: 'ho_branch_snapshot' })
  hoBranchSnapshot: Record<string, unknown>;

  @Column({ type: 'uuid', name: 'issuer_party_profile_id' })
  issuerPartyProfileId: string;

  @Column({ type: 'jsonb', name: 'issuer_party_profile_snapshot' })
  issuerPartyProfileSnapshot: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: CardStockReceiptStatus,
    name: 'status',
    default: CardStockReceiptStatus.POSTED,
  })
  status: CardStockReceiptStatus;

  @Column({ type: 'numeric', precision: 18, scale: 2, name: 'total_fe_amount' })
  totalFeAmount: string;

  @OneToMany(() => CardStockReceiptItem, item => item.receipt, {
    cascade: true,
  })
  items: CardStockReceiptItem[];
}
