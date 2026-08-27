import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './user.entity';
import { UserRole } from '../user-roles/user-role.entity';
import { Role } from '../roles/role.entity';
import { CounterMenuRestriction } from '../counter-menu-restrictions/counter-menu-restriction.entity';
import { BranchCounter } from '../branches/entities/branch-counter.entity';
import { PasswordPolicyModule } from '../password-policy/password-policy.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserRole, Role, CounterMenuRestriction, BranchCounter]), PasswordPolicyModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
