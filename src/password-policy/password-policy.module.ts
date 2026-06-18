import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdvancedSetting } from '../additional-settings/advanced-setting.entity';
import { Company } from '../company/company.entity';
import { PasswordPolicyController } from './password-policy.controller';
import { PasswordPolicyService } from './password-policy.service';

@Module({
  imports: [TypeOrmModule.forFeature([AdvancedSetting, Company])],
  providers: [PasswordPolicyService],
  controllers: [PasswordPolicyController],
  exports: [PasswordPolicyService],
})
export class PasswordPolicyModule {}

