import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { Transaction } from "../transactions/entities/transaction.entity";
import { TransactionItem } from "../transactions/entities/transaction-item.entity";
import { PartyProfile } from "../party-profiles/party-profile.entity";
import { ChequeBook } from "../chequebooks/entities/cheque-book.entity";
import { ManualBook } from "../manual-bill-books/entities/manual-book.entity";
import { TransferRequest } from "../transfers/entities/transfer-request.entity";
import { CardTransferRequest } from "../card-stock/entities/card-transfer-request.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [Transaction, TransactionItem, ChequeBook, ManualBook, TransferRequest, CardTransferRequest],
      "database2",
    ),
    TypeOrmModule.forFeature([PartyProfile]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
