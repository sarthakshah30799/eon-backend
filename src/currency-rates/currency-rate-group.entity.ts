import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../base/base.entity';
import { Currency } from '../currencies/currency.entity';

@Entity('currency_rate_groups')
export class CurrencyRateGroup extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'citext', unique: true })
  code: string;

  @Column({ type: 'citext' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => Currency, currency => currency.pricingGroup)
  currencies: Currency[];
}
