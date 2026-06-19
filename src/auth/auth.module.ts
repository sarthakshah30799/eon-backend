import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from '../users/user.module';
import { SessionService } from './session.service';
import { PasswordPolicyModule } from '../password-policy/password-policy.module';
import { SessionPolicyModule } from '../session-policy/session-policy.module';

@Module({
  imports: [UserModule, PasswordPolicyModule, SessionPolicyModule],
  controllers: [AuthController],
  providers: [AuthService, SessionService],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
