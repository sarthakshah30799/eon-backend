import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FinancialCode } from "./financial-code.entity";
import { FinancialSubProfile } from "../financial-sub-profiles/financial-sub-profile.entity";
import { FinancialCodeService } from "./financial-code.service";
import { FinancialCodeController } from "./financial-code.controller";
import { UserModule } from "../users/user.module";

@Module({
  imports: [TypeOrmModule.forFeature([FinancialCode, FinancialSubProfile]), UserModule],
  providers: [FinancialCodeService],
  controllers: [FinancialCodeController],
  exports: [FinancialCodeService, TypeOrmModule],
})
export class FinancialCodeModule {}
