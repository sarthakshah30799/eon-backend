import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './role.entity';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { Permission } from '../permissions/permission.entity';
import { RolesMenuPermission } from '../roles-menu-permission/roles-menu-permission.entity';
import { Menu } from '../menu/menu.entity';
import { Company } from '../company/company.entity';
import { User } from '../users/user.entity';
import { UserModule } from '../users/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Role,
      Permission,
      RolesMenuPermission,
      Menu,
      Company,
      User,
    ]),
    UserModule,
  ],
  controllers: [RoleController],
  providers: [RoleService],
  exports: [RoleService],
})
export class RoleModule {}
