import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Branch } from "../branches/branch.entity";
import { MonthlyLocksModule } from "../monthly-locks/monthly-locks.module";
import { UserRole } from "../user-roles/user-role.entity";
import { UserModule } from "../users/user.module";
import { TransactionDataLock } from "./entities/transaction-data-lock.entity";
import { TransactionDataLocksService } from "./transaction-data-locks.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([TransactionDataLock], "database2"),
    TypeOrmModule.forFeature([Branch, UserRole]),
    MonthlyLocksModule,
    UserModule,
  ],
  providers: [TransactionDataLocksService],
  exports: [TransactionDataLocksService],
})
export class TransactionDataLocksModule {}
