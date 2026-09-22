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
import { CreditRequestFundController } from "./credit-request-fund.controller";
import { CreditRequestFundService } from "./credit-request-fund.service";
import { CreditRequestFund, CreditRequestFundItem } from "./entities";

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
    ]),
    TypeOrmModule.forFeature(
      [CreditRequestFund, CreditRequestFundItem],
      "database2",
    ),
  ],
  controllers: [CreditRequestFundController],
  providers: [CreditRequestFundService],
  exports: [CreditRequestFundService],
})
export class CreditRequestFundModule {}
