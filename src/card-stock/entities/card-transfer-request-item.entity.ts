import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../base/base.entity';
import { CardTransferRequest } from './card-transfer-request.entity';
import { CardTransferRequestCard } from './card-transfer-request-card.entity';

@Index('IDX_card_transfer_request_items_transfer_line', ['transferId', 'lineNo'], {
  unique: true,
})
@Entity('card_transfer_request_items')
export class CardTransferRequestItem extends BaseEntity {
  @Column({ type: 'uuid', name: 'transfer_id' })
  transferId: string;

  @ManyToOne(() => CardTransferRequest, transfer => transfer.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'transfer_id',
    foreignKeyConstraintName: 'FK_card_transfer_request_items_transfer',
  })
  transfer: CardTransferRequest;

  @Column({ type: 'integer', name: 'line_no' })
  lineNo: number;

  @Column({ type: 'uuid', name: 'currency_id' })
  currencyId: string;

  @Column({ type: 'jsonb', name: 'currency_snapshot' })
  currencySnapshot: Record<string, unknown>;

  @Column({ type: 'numeric', precision: 18, scale: 7 })
  per: string;

  @Column({ type: 'uuid', name: 'product_id' })
  productId: string;

  @Column({ type: 'jsonb', name: 'product_snapshot' })
  productSnapshot: Record<string, unknown>;

  @Column({ type: 'uuid', name: 'issuer_party_profile_id' })
  issuerPartyProfileId: string;

  @Column({ type: 'jsonb', name: 'issuer_party_profile_snapshot' })
  issuerPartyProfileSnapshot: Record<string, unknown>;

  @Column({ type: 'numeric', precision: 18, scale: 2, name: 'fe_amount' })
  feAmount: string;

  @OneToMany(() => CardTransferRequestCard, selection => selection.transferItem, {
    cascade: true,
  })
  selectedCards: CardTransferRequestCard[];
}
