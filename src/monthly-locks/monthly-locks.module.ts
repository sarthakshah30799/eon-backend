import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Branch } from "../branches/branch.entity";
import { User } from "../users/user.entity";
import { UserModule } from "../users/user.module";
import { MonthlyLockWindow } from "./entities/monthly-lock-window.entity";
import { MonthlyLocksController } from "./monthly-locks.controller";
import { MonthlyLocksService } from "./monthly-locks.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([MonthlyLockWindow], "database2"),
    TypeOrmModule.forFeature([Branch, User]),
    UserModule,
  ],
  providers: [MonthlyLocksService],
  controllers: [MonthlyLocksController],
  exports: [MonthlyLocksService],
})
export class MonthlyLocksModule {}
