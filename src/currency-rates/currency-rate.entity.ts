import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base/base.entity';
import { Currency } from '../currencies/currency.entity';
import { User } from '../users/user.entity';
import { CurrencyRateProvider } from './currency-rates.enums';

@Entity('currency_rates')
export class CurrencyRate extends BaseEntity {
  @ManyToOne(() => Currency, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'currency_id' })
  currency: Currency;

  @Index()
  @Column({ name: 'currency_id', type: 'uuid' })
  currencyId: string;

  @Column({ type: 'enum', enum: CurrencyRateProvider })
  provider: CurrencyRateProvider;

  @Column({ type: 'numeric', precision: 18, scale: 7 })
  baseBuyRate: string;

  @Column({ type: 'numeric', precision: 18, scale: 7 })
  baseSaleRate: string;

  @Column({ type: 'numeric', precision: 18, scale: 7, nullable: true })
  baseRate: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'entered_by' })
  enteredByUser: User | null;

  @Column({ name: 'entered_by', type: 'uuid', nullable: true })
  enteredBy: string | null;
}
