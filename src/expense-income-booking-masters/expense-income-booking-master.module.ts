import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpenseIncomeBookingMaster } from './expense-income-booking-master.entity';
import { ExpenseIncomeBookingMasterController } from './expense-income-booking-master.controller';
import { ExpenseIncomeBookingMasterService } from './expense-income-booking-master.service';
import { UserModule } from '../users/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([ExpenseIncomeBookingMaster]), UserModule],
  controllers: [ExpenseIncomeBookingMasterController],
  providers: [ExpenseIncomeBookingMasterService],
  exports: [ExpenseIncomeBookingMasterService],
})
export class ExpenseIncomeBookingMasterModule {}
