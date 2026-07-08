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
    nullable: true,
  })
  buyMarginType: CurrencyRateMarginType | null;

  @Column({ name: 'buy_margin_value', type: 'numeric', nullable: true })
  buyMarginValue: string | null;

  @Column({ name: 'buy_min_rate', type: 'numeric', nullable: true })
  buyMinRate: string | null;

  @Column({ name: 'buy_max_rate', type: 'numeric', nullable: true })
  buyMaxRate: string | null;

  @Column({
    name: 'sale_margin_type',
    type: 'enum',
    enum: CurrencyRateMarginType,
    enumName: 'product_currency_rates_margin_type_enum',
    nullable: true,
  })
  saleMarginType: CurrencyRateMarginType | null;

  @Column({ name: 'sale_margin_value', type: 'numeric', nullable: true })
  saleMarginValue: string | null;

  @Column({ name: 'sale_min_rate', type: 'numeric', nullable: true })
  saleMinRate: string | null;

  @Column({ name: 'sale_max_rate', type: 'numeric', nullable: true })
  saleMaxRate: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
