import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdvancedSetting } from "./advanced-setting.entity";
import { AdditionalSettingService } from "./additional-setting.service";
import { AdditionalSettingController } from "./additional-setting.controller";
import { UserModule } from "../users/user.module";
import { PasswordPolicyModule } from "../password-policy/password-policy.module";
import { SessionPolicyModule } from "../session-policy/session-policy.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdvancedSetting,
    ]),
    UserModule,
    PasswordPolicyModule,
    SessionPolicyModule,
  ],
  providers: [AdditionalSettingService],
  controllers: [AdditionalSettingController],
  exports: [AdditionalSettingService],
})
export class AdditionalSettingModule {}
