import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FinancialSubProfile } from "./financial-sub-profile.entity";
import { FinancialSubProfileService } from "./financial-sub-profile.service";
import { FinancialSubProfileController } from "./financial-sub-profile.controller";
import { FinancialCodeModule } from "../financial-codes/financial-code.module";
import { UserModule } from "../users/user.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([FinancialSubProfile]),
    FinancialCodeModule,
    UserModule,
  ],
  providers: [FinancialSubProfileService],
  controllers: [FinancialSubProfileController],
  exports: [FinancialSubProfileService, TypeOrmModule],
})
export class FinancialSubProfileModule {}
