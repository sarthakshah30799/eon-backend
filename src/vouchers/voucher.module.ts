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
import { Transaction } from "../transactions/entities/transaction.entity";
import { TransactionPayment } from "../transactions/entities/transaction-payment.entity";
import { UserModule } from "../users/user.module";
import {
  AccountingVoucher,
  AccountingVoucherItem,
  VoucherAdvanceApplication,
} from "./entities";
import {
  JournalVoucherController,
  PaymentVoucherController,
  ReceiptVoucherController,
} from "./voucher.controller";
import { VoucherService } from "./voucher.service";

@Module({
  imports: [
    AdditionalSettingModule,
    DayEndStartProcessModule,
    PartyProfileModule,
    UserModule,
    TypeOrmModule.forFeature([
      AccountProfile,
      PartyProfile,
      SelectOption,
      Branch,
      Counter,
      BranchCounter,
    ]),
    TypeOrmModule.forFeature(
      [
        AccountingVoucher,
        AccountingVoucherItem,
        VoucherAdvanceApplication,
        Transaction,
        TransactionPayment,
      ],
      "database2",
    ),
  ],
  controllers: [
    ReceiptVoucherController,
    PaymentVoucherController,
    JournalVoucherController,
  ],
  providers: [VoucherService],
  exports: [VoucherService, TypeOrmModule],
})
export class VoucherModule {}
