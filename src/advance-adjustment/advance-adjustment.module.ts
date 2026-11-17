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
import { AccountingVoucher } from "../vouchers/entities/accounting-voucher.entity";
import { VoucherModule } from "../vouchers/voucher.module";
import { AdvanceAdjustmentController } from "./advance-adjustment.controller";
import { AdvanceAdjustmentService } from "./advance-adjustment.service";
import { AdvanceAdjustment } from "./entities/advance-adjustment.entity";
import { AdvanceAdjustmentItem } from "./entities/advance-adjustment-item.entity";
import { AdvanceAdjustmentLog } from "./entities/advance-adjustment-log.entity";

@Module({
  imports: [
    AdditionalSettingModule,
    DayEndStartProcessModule,
    PartyProfileModule,
    UserModule,
    VoucherModule,
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
        AdvanceAdjustmentLog,
        AccountingVoucher,
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
