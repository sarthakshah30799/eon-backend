import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Counter } from './counter.entity';
import { BranchCounter } from '../branches/entities/branch-counter.entity';
import { CounterService } from './counter.service';
import { CounterController } from './counter.controller';
import { UserModule } from '../users/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Counter, BranchCounter]), UserModule],
  controllers: [CounterController],
  providers: [CounterService],
  exports: [CounterService, TypeOrmModule],
})
export class CounterModule {}
