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

@Module({
  imports: [
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
  ],
  providers: [
    SalePurchaseReportService,
    ProductProfitReportService,
    SpecialReportService,
    CurrencyBalanceReportService,
  ],
})
export class ReportsModule {}
