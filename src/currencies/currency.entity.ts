import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../base/base.entity';
import { Country } from '../country/country.entity';
import { CurrencyRateGroup } from '../currency-rates/currency-rate-group.entity';
import { ProductCurrencyRate } from '../currency-rates/product-currency-rate.entity';

export const CurrencyCalculationMethod = {
  MULTIPLICATION: 'MULTIPLICATION',
  DIVISION: 'DIVISION',
} as const;

export type CurrencyCalculationMethod =
  (typeof CurrencyCalculationMethod)[keyof typeof CurrencyCalculationMethod];

export const CurrencyGroup = {
  ASIA: 'ASIA',
  AFRICA: 'AFRICA',
  EUROPE: 'EUROPE',
  GULF: 'GULF',
} as const;

export type CurrencyGroup =
  (typeof CurrencyGroup)[keyof typeof CurrencyGroup];

export const CurrencyProductAllowed = {
  CN: 'CN',
  CM: 'CM',
  CC: 'CC',
  ET: 'ET',
  TC: 'TC',
  TM: 'TM',
} as const;

export type CurrencyProductAllowed =
  (typeof CurrencyProductAllowed)[keyof typeof CurrencyProductAllowed];

@Entity('currencies')
export class Currency extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'citext', unique: true })
  currencyCode: string;

  @Column({ type: 'citext' })
  currencyName: string;

  @Index()
  @ManyToOne(() => Country, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'country_id' })
  country: Country;

  @Column({ type: 'citext' })
  priority: string;

  @Column({ type: 'numeric' })
  ratePer: string;

  @Column({ type: 'numeric' })
  defaultMinRate: string;

  @Column({ type: 'numeric' })
  defaultMaxRate: string;

  @Column({ type: 'citext', default: CurrencyCalculationMethod.MULTIPLICATION })
  calculationMethod: CurrencyCalculationMethod;

  @Column({ type: 'numeric' })
  openRatePremium: string;

  @Column({ type: 'numeric' })
  gulfDiscFactor: string;

  @Column({ type: 'citext' })
  amexMapCode: string;

  @Column({ type: 'citext', default: CurrencyGroup.ASIA })
  group: CurrencyGroup;

  @Index()
  @ManyToOne(() => CurrencyRateGroup, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'pricing_group_id' })
  pricingGroup: CurrencyRateGroup | null;

  @OneToMany(() => ProductCurrencyRate, rate => rate.currency)
  productCurrencyRates: ProductCurrencyRate[];

  @Column({ type: 'boolean', default: false })
  active: boolean;

  @Column({ type: 'boolean', default: false })
  onlyStocking: boolean;

  @Column({ type: 'citext', default: '' })
  productAllowed: CurrencyProductAllowed | '';
}
