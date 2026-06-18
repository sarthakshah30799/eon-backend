import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdvancedSetting } from "./advanced-setting.entity";
import { AdditionalSettingService } from "./additional-setting.service";
import { AdditionalSettingController } from "./additional-setting.controller";
import { UserModule } from "../users/user.module";
import { PasswordPolicyModule } from "../password-policy/password-policy.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdvancedSetting,
    ]),
    UserModule,
    PasswordPolicyModule,
  ],
  providers: [AdditionalSettingService],
  controllers: [AdditionalSettingController],
  exports: [AdditionalSettingService],
})
export class AdditionalSettingModule {}
