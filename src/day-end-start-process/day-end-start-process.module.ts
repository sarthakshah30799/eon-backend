import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdditionalSettingModule } from "../additional-settings/additional-setting.module";
import { MonthlyLocksModule } from "../monthly-locks/monthly-locks.module";
import { UserModule } from "../users/user.module";
import { DayEndExecution } from "./entities/day-end-execution.entity";
import { DayEndStartProcessController } from "./day-end-start-process.controller";
import { DayEndStartProcessService } from "./day-end-start-process.service";

@Module({
  imports: [
    AdditionalSettingModule,
    MonthlyLocksModule,
    UserModule,
    TypeOrmModule.forFeature([DayEndExecution], "database2"),
  ],
  providers: [DayEndStartProcessService],
  controllers: [DayEndStartProcessController],
  exports: [DayEndStartProcessService],
})
export class DayEndStartProcessModule {}
