import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Country } from '../country/country.entity';
import { Currency } from './currency.entity';
import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';
import { UserModule } from '../users/user.module';
import { CurrencyRateGroup } from '../currency-rates/currency-rate-group.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Currency, Country, CurrencyRateGroup]), UserModule],
  controllers: [CurrencyController],
  providers: [CurrencyService],
  exports: [CurrencyService],
})
export class CurrencyModule {}
