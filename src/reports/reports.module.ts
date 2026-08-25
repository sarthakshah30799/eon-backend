import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Transaction } from "../transactions/entities/transaction.entity";
import { TransactionItem } from "../transactions/entities/transaction-item.entity";
import { TransactionPayment } from "../transactions/entities/transaction-payment.entity";
import { TransactionAdditionalCharge } from "../transactions/entities/transaction-additional-charge.entity";
import { TransactionAccountPosting } from "../transactions/entities/transaction-account-posting.entity";
import { TransactionBalanceCurrency } from "../transactions/entities/transaction-balance-currency.entity";
import { SalePurchaseReportController } from "./sale-purchase-report.controller";
import { SalePurchaseReportService } from "./sale-purchase-report.service";
import { ProductProfitReportController } from "./product-profit-report.controller";
import { ProductProfitReportService } from "./product-profit-report.service";
import { SpecialReportController } from "./special-report.controller";
import { SpecialReportService } from "./special-report.service";
import { CurrencyBalanceReportController } from "./currency-balance-report.controller";
import { CurrencyBalanceReportService } from "./currency-balance-report.service";
import { CardUnsettledReportController } from "./card-unsettled-report.controller";
import { CardUnsettledReportService } from "./card-unsettled-report.service";
import { CardSettledReportController } from "./card-settled-report.controller";
import { CardSettledReportService } from "./card-settled-report.service";
import { CardBlankStockReportController } from "./card-blank-stock-report.controller";
import { CardBlankStockReportService } from "./card-blank-stock-report.service";
import { Flm1DailyCnSummaryController } from "./flm1-daily-cn-summary.controller";
import { Flm1DailyCnSummaryService } from "./flm1-daily-cn-summary.service";
import { Flm3PurchaseFromPublicController } from "./flm3-purchase-from-public.controller";
import { Flm3PurchaseFromPublicService } from "./flm3-purchase-from-public.service";
import { Flm4PurchaseFromFfmcController } from "./flm4-purchase-from-ffmc.controller";
import { Flm4PurchaseFromFfmcService } from "./flm4-purchase-from-ffmc.service";
import { Flm5SalesToPublicController } from "./flm5-sales-to-public.controller";
import { Flm5SalesToPublicService } from "./flm5-sales-to-public.service";
import { Flm6SalesToFfmcController } from "./flm6-sales-to-ffmc.controller";
import { Flm6SalesToFfmcService } from "./flm6-sales-to-ffmc.service";
import { Flm8CnStatementController } from "./flm8-cn-statement.controller";
import { Flm8CnStatementService } from "./flm8-cn-statement.service";
import { AdditionalSettingModule } from "../additional-settings/additional-setting.module";
import { PurposeModule } from "../purpose/purpose.module";
import { DayEndStartProcessModule } from "../day-end-start-process/day-end-start-process.module";
import { TransactionDataLocksModule } from "../transaction-data-locks/transaction-data-locks.module";
import { Branch } from "../branches/branch.entity";
import { Currency } from "../currencies/currency.entity";
import { UserRole } from "../user-roles/user-role.entity";

@Module({
  imports: [
    AdditionalSettingModule,
    PurposeModule,
    DayEndStartProcessModule,
    TransactionDataLocksModule,
    TypeOrmModule.forFeature([Branch, UserRole, Currency]),
    TypeOrmModule.forFeature(
      [
        Transaction,
        TransactionItem,
        TransactionPayment,
        TransactionAdditionalCharge,
        TransactionAccountPosting,
        TransactionBalanceCurrency,
      ],
      "database2",
    ),
  ],
  controllers: [
    SalePurchaseReportController,
    ProductProfitReportController,
    SpecialReportController,
    CurrencyBalanceReportController,
    CardUnsettledReportController,
    CardSettledReportController,
    CardBlankStockReportController,
    Flm1DailyCnSummaryController,
    Flm3PurchaseFromPublicController,
    Flm4PurchaseFromFfmcController,
    Flm5SalesToPublicController,
    Flm6SalesToFfmcController,
    Flm8CnStatementController,
  ],
  providers: [
    SalePurchaseReportService,
    ProductProfitReportService,
    SpecialReportService,
    CurrencyBalanceReportService,
    CardUnsettledReportService,
    CardSettledReportService,
    CardBlankStockReportService,
    Flm1DailyCnSummaryService,
    Flm3PurchaseFromPublicService,
    Flm4PurchaseFromFfmcService,
    Flm5SalesToPublicService,
    Flm6SalesToFfmcService,
    Flm8CnStatementService,
  ],
})
export class ReportsModule {}
