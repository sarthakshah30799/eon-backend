import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailConfig } from './entities/mail-config.entity';
import { ConfigModule } from '../config/config.module';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MailConfig]),
    ConfigModule,
  ],
  providers: [MailService],
  controllers: [MailController],
  exports: [MailService],
})
export class MailModule {}
