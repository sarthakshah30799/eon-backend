import { Check, Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../base/base.entity';
import { PurposeSlab } from './purpose-slab.entity';
import { PurposeRateType } from './purpose.enums';

@Entity('purposes')
@Index('IDX_purposes_code', ['code'], { unique: true })
@Check('CHK_purposes_code_length', 'char_length("code") = 2')
@Check('CHK_purposes_scope_flags', '("corporate" OR "individual") AND ("sell" OR "purchase")')
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

  @Column({ type: 'boolean', name: 'corporate', default: false })
  corporate: boolean;

  @Column({ type: 'boolean', name: 'individual', default: false })
  individual: boolean;

  @Column({ type: 'boolean', name: 'sell', default: false })
  sell: boolean;

  @Column({ type: 'boolean', name: 'purchase', default: false })
  purchase: boolean;

  @OneToMany(() => PurposeSlab, slab => slab.purpose, {
    cascade: true,
  })
  slabs: PurposeSlab[];
}
