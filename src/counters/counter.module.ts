import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Counter } from './counter.entity';
import { CounterService } from './counter.service';
import { CounterController } from './counter.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Counter])],
  controllers: [CounterController],
  providers: [CounterService],
  exports: [CounterService],
})
export class CounterModule {}
