import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Currency } from '../currencies/currency.entity';
import { Product } from '../products/product.entity';
import { CurrencyRatesController } from './currency-rates.controller';
import { CurrencyRateGroup } from './currency-rate-group.entity';
import { CurrencyRate } from './currency-rate.entity';
import { ProductCurrencyRate } from './product-currency-rate.entity';
import { CurrencyRatesService } from './currency-rates.service';
import { UserModule } from '../users/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CurrencyRateGroup, CurrencyRate, ProductCurrencyRate, Product, Currency]),
    UserModule,
  ],
  controllers: [CurrencyRatesController],
  providers: [CurrencyRatesService],
  exports: [CurrencyRatesService],
})
export class CurrencyRatesModule {}
