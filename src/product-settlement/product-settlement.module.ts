import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdditionalSettingModule } from "../additional-settings/additional-setting.module";
import { Branch } from "../branches/branch.entity";
import { CardStockModule } from "../card-stock/card-stock.module";
import { CardStockCard } from "../card-stock/entities/card-stock-card.entity";
import { DayEndStartProcessModule } from "../day-end-start-process/day-end-start-process.module";
import { DealCover } from "../tt-deal/entities/deal-cover.entity";
import { ProductSettlementController } from "./product-settlement.controller";
import { ProductSettlementService } from "./product-settlement.service";
import { ProductSettlementWorker } from "./product-settlement.worker";
import {
  ProductSettlement,
  ProductSettlementDocument,
} from "./entities";

@Module({
  imports: [
    AdditionalSettingModule,
    DayEndStartProcessModule,
    forwardRef(() => CardStockModule),
    TypeOrmModule.forFeature([Branch]),
    TypeOrmModule.forFeature(
      [
        ProductSettlement,
        ProductSettlementDocument,
        CardStockCard,
        DealCover,
      ],
      "database2",
    ),
  ],
  controllers: [ProductSettlementController],
  providers: [ProductSettlementService, ProductSettlementWorker],
  exports: [ProductSettlementService],
})
export class ProductSettlementModule {}

/** @deprecated Prefer ProductSettlementService */
export { ProductSettlementService as CardStockSettlementService };
