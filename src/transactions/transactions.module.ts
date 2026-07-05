import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Transaction } from "./entities/transaction.entity";
import { TransactionItem } from "./entities/transaction-item.entity";
import { TransactionDocument } from "./entities/transaction-document.entity";
import { TransactionAdditionalCharge } from "./entities/transaction-additional-charge.entity";
import { TransactionPayment } from "./entities/transaction-payment.entity";
import { TransactionLog } from "./entities/transaction-log.entity";
import { TransactionEvent } from "./entities/transaction-event.entity";
import { TransactionsController } from "./transactions.controller";
import { TransactionsService } from "./transactions.service";
import { MailModule } from "../mail/mail.module";

@Module({
  imports: [
    MailModule,
    TypeOrmModule.forFeature(
      [
        Transaction,
        TransactionItem,
        TransactionDocument,
        TransactionAdditionalCharge,
        TransactionPayment,
        TransactionLog,
        TransactionEvent,
      ],
      "database2",
    ),
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [
    TypeOrmModule,
    TransactionsService,
  ],
})
export class TransactionsModule {}
