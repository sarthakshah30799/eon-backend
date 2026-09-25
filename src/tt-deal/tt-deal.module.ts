import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccountProfile } from "../account-profiles/account-profile.entity";
import { AdditionalSettingModule } from "../additional-settings/additional-setting.module";
import { Branch } from "../branches/branch.entity";
import { SelectOption } from "../category-options/category-option.entity";
import { Currency } from "../currencies/currency.entity";
import { CurrencyRatesModule } from "../currency-rates/currency-rates.module";
import { DayEndStartProcessModule } from "../day-end-start-process/day-end-start-process.module";
import { MailModule } from "../mail/mail.module";
import { Passenger } from "../passengers/passenger.entity";
import { PartyProfile } from "../party-profiles/party-profile.entity";
import { ProductIssuer } from "../products/entities/product-issuer.entity";
import { Product } from "../products/product.entity";
import { PurposeSubpurpose } from "../purpose/purpose-subpurpose.entity";
import { Purpose } from "../purpose/purpose.entity";
import { UserRole } from "../user-roles/user-role.entity";
import { DealCover, TtRemittanceDetail } from "./entities";
import { DealCoverController } from "./deal-cover.controller";
import { DealCoverService } from "./deal-cover.service";

@Module({
  imports: [
    AdditionalSettingModule,
    DayEndStartProcessModule,
    CurrencyRatesModule,
    MailModule,
    TypeOrmModule.forFeature([
      Branch,
      AccountProfile,
      Product,
      ProductIssuer,
      PartyProfile,
      Passenger,
      Purpose,
      PurposeSubpurpose,
      SelectOption,
      Currency,
      UserRole,
    ]),
    TypeOrmModule.forFeature([DealCover, TtRemittanceDetail], "database2"),
  ],
  controllers: [DealCoverController],
  providers: [DealCoverService],
  exports: [DealCoverService],
})
export class TtDealModule {}
