import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../company/company.entity';
import { Branch } from '../branches/branch.entity';
import { Counter } from '../counters/counter.entity';
import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';
import { UserRole } from '../user-roles/user-role.entity';
import { MigrationToolService } from './migration-tool.service';
import { MigrationToolController } from './migration-tool.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Company, Branch, Counter, User, Role, UserRole])],
  controllers: [MigrationToolController],
  providers: [MigrationToolService],
  exports: [MigrationToolService],
})
export class MigrationToolModule {}

