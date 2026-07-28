import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CountryGroup } from "./country-group.entity";
import { CountryGroupController } from "./country-group.controller";
import { CountryGroupService } from "./country-group.service";
import { UserModule } from "../users/user.module";
import { Currency } from "../currencies/currency.entity";

@Module({
  imports: [TypeOrmModule.forFeature([CountryGroup, Currency]), UserModule],
  controllers: [CountryGroupController],
  providers: [CountryGroupService],
  exports: [CountryGroupService],
})
export class CountryGroupModule {}
