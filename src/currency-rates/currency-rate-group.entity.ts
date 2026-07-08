import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../base/base.entity';
import { Currency } from '../currencies/currency.entity';
import { CurrencyRateMarginType } from './currency-rates.enums';

@Entity('currency_rate_groups')
export class CurrencyRateGroup extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'citext', unique: true })
  code: string;

  @Column({ type: 'citext' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'buy_margin_type', type: 'enum', enum: CurrencyRateMarginType, enumName: 'currency_rate_groups_margin_type_enum', nullable: true })
  buyMarginType: CurrencyRateMarginType | null;

  @Column({ name: 'buy_margin_value', type: 'numeric', nullable: true })
  buyMarginValue: string | null;

  @Column({ name: 'sale_margin_type', type: 'enum', enum: CurrencyRateMarginType, enumName: 'currency_rate_groups_margin_type_enum', nullable: true })
  saleMarginType: CurrencyRateMarginType | null;

  @Column({ name: 'sale_margin_value', type: 'numeric', nullable: true })
  saleMarginValue: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => Currency, currency => currency.pricingGroup)
  currencies: Currency[];
}
