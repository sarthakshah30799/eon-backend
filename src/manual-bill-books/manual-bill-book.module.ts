import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManualBook } from './entities/manual-book.entity';
import { ManualBookPageTracking } from './entities/manual-book-page-tracking.entity';
import { Branch } from '../branches/branch.entity';
import { ManualBillBookService } from './manual-bill-book.service';
import { ManualBillBookController } from './manual-bill-book.controller';
import { UserModule } from '../users/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ManualBook, ManualBookPageTracking], 'database2'),
    TypeOrmModule.forFeature([Branch]),
    UserModule,
  ],
  controllers: [ManualBillBookController],
  providers: [ManualBillBookService],
  exports: [ManualBillBookService],
})
export class ManualBillBookModule {}
