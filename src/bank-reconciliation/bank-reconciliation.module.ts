import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccountProfile } from "../account-profiles/account-profile.entity";
import { Branch } from "../branches/branch.entity";
import { TransactionPayment } from "../transactions/entities/transaction-payment.entity";
import { UserModule } from "../users/user.module";
import { AccountingVoucher } from "../vouchers/entities";
import { BankReconciliationController } from "./bank-reconciliation.controller";
import { BankReconciliationService } from "./bank-reconciliation.service";

@Module({
  imports: [
    UserModule,
    TypeOrmModule.forFeature([AccountProfile, Branch]),
    TypeOrmModule.forFeature(
      [AccountingVoucher, TransactionPayment],
      "database2",
    ),
  ],
  controllers: [BankReconciliationController],
  providers: [BankReconciliationService],
  exports: [BankReconciliationService],
})
export class BankReconciliationModule {}
