import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChequeBook } from './entities/cheque-book.entity';
import { ChequeBookPageTracking } from './entities/cheque-book-page-tracking.entity';
import { Branch } from '../branches/branch.entity';
import { AccountProfile } from '../account-profiles/account-profile.entity';
import { ChequeBookService } from './chequebook.service';
import { ChequeBookController } from './chequebook.controller';
import { UserModule } from '../users/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChequeBook, ChequeBookPageTracking], 'database2'),
    TypeOrmModule.forFeature([Branch, AccountProfile]),
    UserModule,
  ],
  controllers: [ChequeBookController],
  providers: [ChequeBookService],
  exports: [ChequeBookService],
})
export class ChequeBookModule {}
