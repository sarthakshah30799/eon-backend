import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdvancedSetting } from '../additional-settings/advanced-setting.entity';
import { SessionPolicyService } from './session-policy.service';

@Module({
  imports: [TypeOrmModule.forFeature([AdvancedSetting])],
  providers: [SessionPolicyService],
  exports: [SessionPolicyService],
})
export class SessionPolicyModule {}
