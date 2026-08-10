import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdditionalSettingModule } from '../additional-settings/additional-setting.module';
import { DayEndStartProcessModule } from '../day-end-start-process/day-end-start-process.module';
import { Branch } from '../branches/branch.entity';
import { Counter } from '../counters/counter.entity';
import { Currency } from '../currencies/currency.entity';
import { PartyProfile } from '../party-profiles/party-profile.entity';
import { Product } from '../products/product.entity';
import { ProductCardIssuer } from '../products/entities/product-card-issuer.entity';
import { CardStockCard, CardStockReceipt, CardStockReceiptItem } from './entities';
import { CardStockController } from './card-stock.controller';
import { CardStockService } from './card-stock.service';

@Module({
  imports: [AdditionalSettingModule, DayEndStartProcessModule, TypeOrmModule.forFeature([Branch, Counter, Currency, PartyProfile, Product, ProductCardIssuer]), TypeOrmModule.forFeature([CardStockReceipt, CardStockReceiptItem, CardStockCard], 'database2')],
  controllers: [CardStockController],
  providers: [CardStockService],
})
export class CardStockModule {}
