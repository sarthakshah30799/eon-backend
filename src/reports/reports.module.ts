import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Transaction } from "../transactions/entities/transaction.entity";
import { TransactionItem } from "../transactions/entities/transaction-item.entity";
import { TransactionPayment } from "../transactions/entities/transaction-payment.entity";
import { TransactionAdditionalCharge } from "../transactions/entities/transaction-additional-charge.entity";
import { SalePurchaseReportController } from "./sale-purchase-report.controller";
import { SalePurchaseReportService } from "./sale-purchase-report.service";

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        Transaction,
        TransactionItem,
        TransactionPayment,
        TransactionAdditionalCharge,
      ],
      "database2",
    ),
  ],
  controllers: [SalePurchaseReportController],
  providers: [SalePurchaseReportService],
})
export class ReportsModule {}
