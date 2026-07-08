import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { State } from "./state.entity";
import { Country } from "../country/country.entity";
import { StateController } from "./state.controller";
import { StateService } from "./state.service";
import { UserModule } from "../users/user.module";

@Module({
  imports: [TypeOrmModule.forFeature([State, Country]), UserModule],
  controllers: [StateController],
  providers: [StateService],
  exports: [StateService],
})
export class StateModule {}
