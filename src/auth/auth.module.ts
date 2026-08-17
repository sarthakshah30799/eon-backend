import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from '../users/user.module';
import { SessionService } from './session.service';
import { PasswordPolicyModule } from '../password-policy/password-policy.module';
import { SessionPolicyModule } from '../session-policy/session-policy.module';
import { MailModule } from '../mail/mail.module';
import { DayEndStartProcessModule } from '../day-end-start-process/day-end-start-process.module';
import { Counter } from '../counters/counter.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Counter]),
    UserModule,
    PasswordPolicyModule,
    SessionPolicyModule,
    MailModule,
    DayEndStartProcessModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionService],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
