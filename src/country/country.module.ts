import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Country } from "./country.entity";
import { Branch } from "../branches/branch.entity";
import { User } from "../users/user.entity";
import { UserModule } from "../users/user.module";
import { UnblockCountryAccess } from "./entities/unblock-country-access.entity";
import { CountryController } from "./country.controller";
import { CountryService } from "./country.service";

@Module({
  imports: [TypeOrmModule.forFeature([Country, Branch, User, UnblockCountryAccess]), UserModule],
  controllers: [CountryController],
  providers: [CountryService],
  exports: [CountryService],
})
export class CountryModule {}
