import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdditionalSettingModule } from "../additional-settings/additional-setting.module";
import { DayEndStartProcessModule } from "../day-end-start-process/day-end-start-process.module";
import { MailModule } from "../mail/mail.module";
import { SpreadsheetUploadModule } from "../common/upload/spreadsheet-upload.module";
import { Branch } from "../branches/branch.entity";
import { Currency } from "../currencies/currency.entity";
import { PartyProfile } from "../party-profiles/party-profile.entity";
import { Product } from "../products/product.entity";
import { ProductCardIssuer } from "../products/entities/product-card-issuer.entity";
import { User } from "../users/user.entity";
import { UserModule } from "../users/user.module";
import { CompanyModule } from "../company/company.module";
import { UserRole } from "../user-roles/user-role.entity";
import {
  CardStockCard,
  CardStockReceipt,
  CardStockReceiptItem,
  CardTransferRequest,
  CardTransferRequestCard,
  CardTransferRequestItem,
  CardStockTransactionEntry,
  CardStockBalance,
  CardStockSettlement,
  CardStockSettlementDocument,
} from "./entities";
import { CardStockController } from "./card-stock.controller";
import { CardStockService } from "./card-stock.service";
import { CardTransferController } from "./card-transfer.controller";
import { CardTransferService } from "./card-transfer.service";
import { CardStockTransactionService } from "./card-stock-transaction.service";
import { CardStockSettlementService } from "./card-stock-settlement.service";
import { CardStockSettlementWorker } from "./card-stock-settlement.worker";
import { CardStockSettlementController } from "./card-stock-settlement.controller";
import { CardStockSaleLifecycleService } from "./card-stock-sale-lifecycle.service";
import { CardStockPrintService } from "./card-stock-print.service";
import { TransactionLog } from "../transactions/entities/transaction-log.entity";

@Module({
  imports: [
    AdditionalSettingModule,
    DayEndStartProcessModule,
    MailModule,
    SpreadsheetUploadModule,
    UserModule,
    CompanyModule,
    TypeOrmModule.forFeature([
      Branch,
      Currency,
      PartyProfile,
      Product,
      ProductCardIssuer,
      User,
      UserRole,
    ]),
    TypeOrmModule.forFeature(
      [
        CardStockReceipt,
        CardStockReceiptItem,
        CardStockCard,
        CardTransferRequest,
        CardTransferRequestItem,
        CardTransferRequestCard,
        CardStockTransactionEntry,
        CardStockBalance,
        CardStockSettlement,
        CardStockSettlementDocument,
        TransactionLog,
      ],
      "database2",
    ),
  ],
  controllers: [
    CardStockController,
    CardTransferController,
    CardStockSettlementController,
  ],
  providers: [
    CardStockService,
    CardTransferService,
    CardStockTransactionService,
    CardStockSettlementService,
    CardStockSaleLifecycleService,
    CardStockSettlementWorker,
    CardStockPrintService,
  ],
  exports: [
    CardStockTransactionService,
    CardStockSettlementService,
    CardStockSaleLifecycleService,
  ],
})
export class CardStockModule {}
