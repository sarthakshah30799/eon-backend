import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Country } from "./country.entity";
import { CountryController } from "./country.controller";
import { CountryService } from "./country.service";
import { UserModule } from "../users/user.module";

@Module({
  imports: [TypeOrmModule.forFeature([Country]), UserModule],
  controllers: [CountryController],
  providers: [CountryService],
  exports: [CountryService],
})
export class CountryModule {}
