import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccountProfile } from "../account-profiles/account-profile.entity";
import { AdditionalSettingModule } from "../additional-settings/additional-setting.module";
import { Branch } from "../branches/branch.entity";
import { BranchCounter } from "../branches/entities/branch-counter.entity";
import { SelectOption } from "../category-options/category-option.entity";
import { Counter } from "../counters/counter.entity";
import { DayEndStartProcessModule } from "../day-end-start-process/day-end-start-process.module";
import { PartyProfile } from "../party-profiles/party-profile.entity";
import { PartyProfileModule } from "../party-profiles/party-profile.module";
import { UserModule } from "../users/user.module";
import { VoucherModule } from "../vouchers/voucher.module";
import { AdvanceRefundController } from "./advance-refund.controller";
import { AdvanceRefundService } from "./advance-refund.service";
import { User } from "../users/user.entity";
import { AdvanceRefund } from "./entities/advance-refund.entity";
import { AdvanceRefundItem } from "./entities/advance-refund-item.entity";
import { AdvanceRefundPrintLog } from "./entities/advance-refund-print-log.entity";

@Module({
  imports: [
    AdditionalSettingModule,
    DayEndStartProcessModule,
    PartyProfileModule,
    UserModule,
    VoucherModule,
    TypeOrmModule.forFeature([
      AccountProfile,
      PartyProfile,
      SelectOption,
      Branch,
      Counter,
      BranchCounter,
      User,
    ]),
    TypeOrmModule.forFeature(
      [AdvanceRefund, AdvanceRefundItem, AdvanceRefundPrintLog],
      "database2",
    ),
  ],
  controllers: [AdvanceRefundController],
  providers: [AdvanceRefundService],
  exports: [AdvanceRefundService],
})
export class AdvanceRefundModule {}
