import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccountProfile } from "./account-profile.entity";
import { Currency } from "../currencies/currency.entity";
import { FinancialCode } from "../financial-codes/financial-code.entity";
import { FinancialSubProfile } from "../financial-sub-profiles/financial-sub-profile.entity";
import { Branch } from "../branches/branch.entity";
import { SelectOption } from "../category-options/category-option.entity";
import { AccountProfileController } from "./account-profile.controller";
import { AccountProfileService } from "./account-profile.service";
import { UserModule } from "../users/user.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountProfile,
      Currency,
      FinancialCode,
      FinancialSubProfile,
      Branch,
      SelectOption,
    ]),
    UserModule,
  ],
  controllers: [AccountProfileController],
  providers: [AccountProfileService],
  exports: [AccountProfileService],
})
export class AccountProfileModule {}
