import { Column, Entity, Index, OneToMany, Check } from 'typeorm';
import { BaseEntity } from '../base/base.entity';
import { PurposeSlab } from './purpose-slab.entity';
import { PurposeRateType } from './purpose.enums';
import { TransactionType } from '../transactions/transactions.enums';

@Entity('purposes')
@Index('IDX_purposes_code', ['code'], { unique: true })
@Index('IDX_purposes_transaction_type', ['transactionType'])
@Check('CHK_purposes_code_length', 'char_length("code") = 2')
export class Purpose extends BaseEntity {
  @Column({ type: 'citext' })
  code: string;

  @Column({ type: 'citext' })
  description: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  threshold: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  rate: string;

  @Column({
    type: 'enum',
    enum: PurposeRateType,
    enumName: 'purpose_rate_type_enum',
    name: 'rate_type',
    default: PurposeRateType.PERCENT,
  })
  rateType: PurposeRateType;

  @Column({
    type: 'enum',
    enum: TransactionType,
    enumName: 'transactions_transaction_type_enum',
    name: 'transaction_type',
  })
  transactionType: TransactionType;

  @OneToMany(() => PurposeSlab, slab => slab.purpose, {
    cascade: true,
  })
  slabs: PurposeSlab[];
}
