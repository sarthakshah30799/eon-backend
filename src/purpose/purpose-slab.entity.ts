import { Column, Entity, Index, JoinColumn, ManyToOne, Unique, Check } from 'typeorm';
import { BaseEntity } from '../base/base.entity';
import { Purpose } from './purpose.entity';
import { PurposeRateType } from './purpose.enums';

@Entity('purpose_slabs')
@Unique('UQ_purpose_slabs_purpose_id_sort_order', ['purposeId', 'sortOrder'])
@Index('IDX_purpose_slabs_purpose_id', ['purposeId'])
@Check('CHK_purpose_slabs_from_to', `"to_amount" IS NULL OR "to_amount" >= "from_amount"`)
export class PurposeSlab extends BaseEntity {
  @Column({ type: 'uuid', name: 'purpose_id' })
  purposeId: string;

  @ManyToOne(() => Purpose, purpose => purpose.slabs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'purpose_id',
    foreignKeyConstraintName: 'FK_purpose_slabs_purpose_id',
  })
  purpose: Purpose;

  @Column({ type: 'int', name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ type: 'numeric', name: 'from_amount', precision: 18, scale: 2 })
  fromAmount: string;

  @Column({ type: 'numeric', name: 'to_amount', precision: 18, scale: 2, nullable: true })
  toAmount: string | null;

  @Column({ type: 'numeric', name: 'rate', precision: 18, scale: 2 })
  rate: string;

  @Column({
    type: 'enum',
    enum: PurposeRateType,
    enumName: 'purpose_slabs_rate_type_enum',
    name: 'rate_type',
    default: PurposeRateType.PERCENT,
  })
  rateType: PurposeRateType;
}
