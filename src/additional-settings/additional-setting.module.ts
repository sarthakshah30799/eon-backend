import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdvancedSetting } from "./advanced-setting.entity";
import { Company } from "../company/company.entity";
import { AdditionalSettingService } from "./additional-setting.service";
import { AdditionalSettingController } from "./additional-setting.controller";
import { UserModule } from "../users/user.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdvancedSetting,
      Company,
    ]),
    UserModule,
  ],
  providers: [AdditionalSettingService],
  controllers: [AdditionalSettingController],
  exports: [AdditionalSettingService],
})
export class AdditionalSettingModule {}
