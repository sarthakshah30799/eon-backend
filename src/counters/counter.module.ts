import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Counter } from "./counter.entity";
import { BranchCounter } from "../branches/entities/branch-counter.entity";
import { CounterMenuRestriction } from "../counter-menu-restrictions/counter-menu-restriction.entity";
import { Permission } from "../permissions/permission.entity";
import { Menu } from "../menu/menu.entity";
import { CounterService } from "./counter.service";
import { CounterController } from "./counter.controller";
import { UserModule } from "../users/user.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Counter,
      BranchCounter,
      CounterMenuRestriction,
      Permission,
      Menu,
    ]),
    UserModule,
  ],
  controllers: [CounterController],
  providers: [CounterService],
  exports: [CounterService, TypeOrmModule],
})
export class CounterModule {}
