import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdditionalSettingModule } from "../additional-settings/additional-setting.module";
import { MonthlyLocksModule } from "../monthly-locks/monthly-locks.module";
import { PartyProfile } from "../party-profiles/party-profile.entity";
import { TransactionDataLocksModule } from "../transaction-data-locks/transaction-data-locks.module";
import { UserModule } from "../users/user.module";
import { DayEndProcessWorker } from "./day-end-process.worker";
import { DayEndStartProcessController } from "./day-end-start-process.controller";
import { DayEndStartProcessService } from "./day-end-start-process.service";
import { DayEndEvent } from "./entities/day-end-event.entity";
import { DayEndExecution } from "./entities/day-end-execution.entity";

@Module({
  imports: [
    AdditionalSettingModule,
    MonthlyLocksModule,
    TransactionDataLocksModule,
    UserModule,
    TypeOrmModule.forFeature([DayEndExecution, DayEndEvent], "database2"),
    TypeOrmModule.forFeature([PartyProfile]),
  ],
  providers: [DayEndStartProcessService, DayEndProcessWorker],
  controllers: [DayEndStartProcessController],
  exports: [DayEndStartProcessService],
})
export class DayEndStartProcessModule {}
