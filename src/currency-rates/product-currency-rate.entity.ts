import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base/base.entity';
import { Currency } from '../currencies/currency.entity';
import { Product } from '../products/product.entity';
import { CurrencyRateMarginType } from './currency-rates.enums';

@Index('IDX_product_currency_rates_product_currency', ['productId', 'currencyId'], { unique: true })
@Entity('product_currency_rates')
export class ProductCurrencyRate extends BaseEntity {
  @ManyToOne(() => Product, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Currency, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'currency_id' })
  currency: Currency;

  @Column({ name: 'currency_id', type: 'uuid' })
  currencyId: string;

  @Column({
    name: 'buy_margin_type',
    type: 'enum',
    enum: CurrencyRateMarginType,
    enumName: 'product_currency_rates_margin_type_enum',
  })
  buyMarginType: CurrencyRateMarginType;

  @Column({ name: 'buy_margin_value', type: 'numeric' })
  buyMarginValue: string;

  @Column({ name: 'buy_min_rate', type: 'numeric' })
  buyMinRate: string;

  @Column({ name: 'buy_max_rate', type: 'numeric' })
  buyMaxRate: string;

  @Column({
    name: 'sale_margin_type',
    type: 'enum',
    enum: CurrencyRateMarginType,
    enumName: 'product_currency_rates_margin_type_enum',
  })
  saleMarginType: CurrencyRateMarginType;

  @Column({ name: 'sale_margin_value', type: 'numeric' })
  saleMarginValue: string;

  @Column({ name: 'sale_min_rate', type: 'numeric' })
  saleMinRate: string;

  @Column({ name: 'sale_max_rate', type: 'numeric' })
  saleMaxRate: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
