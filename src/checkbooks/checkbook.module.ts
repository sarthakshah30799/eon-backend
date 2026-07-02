import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckBook } from './entities/check-book.entity';
import { CheckBookAllocation } from './entities/check-book-allocation.entity';
import { Branch } from '../branches/branch.entity';
import { CheckBookService } from './checkbook.service';
import { CheckBookController } from './checkbook.controller';
import { UserModule } from '../users/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CheckBook, CheckBookAllocation], 'database2'),
    TypeOrmModule.forFeature([Branch]),
    UserModule,
  ],
  controllers: [CheckBookController],
  providers: [CheckBookService],
  exports: [CheckBookService],
})
export class CheckBookModule {}
