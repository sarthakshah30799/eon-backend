import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdvancedSetting } from '../additional-settings/advanced-setting.entity';
import { Company } from '../company/company.entity';
import { Currency } from '../currencies/currency.entity';
import { CurrencyRatesController } from './currency-rates.controller';
import { CurrencyRateGroup } from './currency-rate-group.entity';
import { CurrencyRate } from './currency-rate.entity';
import { CurrencyRatesService } from './currency-rates.service';
import { UserModule } from '../users/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CurrencyRateGroup, CurrencyRate, Currency, AdvancedSetting, Company]),
    UserModule,
  ],
  controllers: [CurrencyRatesController],
  providers: [CurrencyRatesService],
  exports: [CurrencyRatesService],
})
export class CurrencyRatesModule {}
