import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from './branch.entity';
import { Counter } from '../counters/counter.entity';
import { Country } from '../country/country.entity';
import { State } from '../state/state.entity';
import { BranchService } from './branch.service';
import { BranchController } from './branch.controller';
import { UserModule } from '../users/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Branch, Counter, Country, State]), UserModule],
  controllers: [BranchController],
  providers: [BranchService],
  exports: [BranchService],
})
export class BranchModule {}
