import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from '../branches/branch.entity';
import { Currency } from '../currencies/currency.entity';
import { Counter } from '../counters/counter.entity';
import { AdditionalSettingModule } from '../additional-settings/additional-setting.module';
import { StockRevaluation } from './entities/stock-revaluation.entity';
import { StockRevaluationItem } from './entities/stock-revaluation-item.entity';
import { StockRevaluationController } from './stock-revaluation.controller';
import { StockRevaluationService } from './stock-revaluation.service';

@Module({
  imports: [
    AdditionalSettingModule,
    TypeOrmModule.forFeature([Branch, Currency, Counter]),
    TypeOrmModule.forFeature([StockRevaluation, StockRevaluationItem], 'database2'),
  ],
  controllers: [StockRevaluationController],
  providers: [StockRevaluationService],
})
export class StockRevaluationModule {}
