import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Transaction } from "./entities/transaction.entity";
import { TransactionItem } from "./entities/transaction-item.entity";
import { TransactionDocument } from "./entities/transaction-document.entity";
import { TransactionAdditionalCharge } from "./entities/transaction-additional-charge.entity";
import { TransactionPayment } from "./entities/transaction-payment.entity";
import { TransactionAccountPosting } from "./entities/transaction-account-posting.entity";
import { TransactionLog } from "./entities/transaction-log.entity";
import { TransactionEvent } from "./entities/transaction-event.entity";
import { OtherTransaction } from "./entities/other-transaction.entity";
import { TransactionsController } from "./transactions.controller";
import { TransactionsService } from "./transactions.service";
import { OtherTransactionService } from "./other-transaction.service";
import { OtherTransactionController } from "./other-transaction.controller";
import { TransactionAccountPostingWorker } from "./transaction-account-posting.worker";
import { MailModule } from "../mail/mail.module";
import { StorageModule } from "../storage/storage.module";
import { Currency } from "../currencies/currency.entity";
import { Product } from "../products/product.entity";
import { SelectOption } from "../category-options/category-option.entity";
import { DocumentProfile } from "../document-profiles/document-profile.entity";
import { AccountProfile } from "../account-profiles/account-profile.entity";
import { PartyProfile } from "../party-profiles/party-profile.entity";
import { CompanyModule } from "../company/company.module";
import { Branch } from "../branches/branch.entity";
import { User } from "../users/user.entity";
import { ManualBookPageTracking } from "../manual-bill-books/entities/manual-book-page-tracking.entity";
import { ChequeBookPageTracking } from "../chequebooks/entities/cheque-book-page-tracking.entity";
import { AdditionalSettingModule } from "../additional-settings/additional-setting.module";
import { Counter } from "../counters/counter.entity";

@Module({
  imports: [
    CompanyModule,
    AdditionalSettingModule,
    MailModule,
    StorageModule,
    TypeOrmModule.forFeature([
      Currency,
      Product,
      SelectOption,
      DocumentProfile,
      AccountProfile,
      PartyProfile,
      Branch,
      Counter,
      User,
    ]),
    TypeOrmModule.forFeature(
      [
        Transaction,
        OtherTransaction,
        TransactionItem,
        TransactionDocument,
        TransactionAdditionalCharge,
        TransactionPayment,
        TransactionAccountPosting,
        TransactionLog,
        TransactionEvent,
        ManualBookPageTracking,
        ChequeBookPageTracking,
      ],
      "database2",
    ),
  ],
  controllers: [OtherTransactionController, TransactionsController],
  providers: [TransactionsService, OtherTransactionService, TransactionAccountPostingWorker],
  exports: [
    TypeOrmModule,
    TransactionsService,
  ],
})
export class TransactionsModule {}
