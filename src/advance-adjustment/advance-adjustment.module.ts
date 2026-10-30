import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdditionalSettingModule } from "../additional-settings/additional-setting.module";
import { Branch } from "../branches/branch.entity";
import { BranchCounter } from "../branches/entities/branch-counter.entity";
import { Counter } from "../counters/counter.entity";
import { DayEndStartProcessModule } from "../day-end-start-process/day-end-start-process.module";
import { PartyProfile } from "../party-profiles/party-profile.entity";
import { PartyProfileModule } from "../party-profiles/party-profile.module";
import { Transaction } from "../transactions/entities/transaction.entity";
import { User } from "../users/user.entity";
import { UserModule } from "../users/user.module";
import { AdvanceAdjustmentController } from "./advance-adjustment.controller";
import { AdvanceAdjustmentService } from "./advance-adjustment.service";
import { AdvanceAdjustment } from "./entities/advance-adjustment.entity";
import { AdvanceAdjustmentItem } from "./entities/advance-adjustment-item.entity";
import { AdvanceAdjustmentPrintLog } from "./entities/advance-adjustment-print-log.entity";

@Module({
  imports: [
    AdditionalSettingModule,
    DayEndStartProcessModule,
    PartyProfileModule,
    UserModule,
    TypeOrmModule.forFeature([
      PartyProfile,
      Branch,
      Counter,
      BranchCounter,
      User,
    ]),
    TypeOrmModule.forFeature(
      [
        AdvanceAdjustment,
        AdvanceAdjustmentItem,
        AdvanceAdjustmentPrintLog,
        Transaction,
      ],
      "database2",
    ),
  ],
  controllers: [AdvanceAdjustmentController],
  providers: [AdvanceAdjustmentService],
  exports: [AdvanceAdjustmentService],
})
export class AdvanceAdjustmentModule {}
