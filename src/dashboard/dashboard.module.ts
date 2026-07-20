import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { Transaction } from "../transactions/entities/transaction.entity";
import { TransactionItem } from "../transactions/entities/transaction-item.entity";
import { PartyProfile } from "../party-profiles/party-profile.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, TransactionItem], "database2"),
    TypeOrmModule.forFeature([PartyProfile]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
