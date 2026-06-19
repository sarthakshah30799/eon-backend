import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CorporateClient } from "../corporate-clients/corporate-client.entity";
import { Branch } from "../branches/branch.entity";
import { State } from "../state/state.entity";
import { UserModule } from "../users/user.module";
import { FfmcClientController } from "./ffmc-client.controller";
import { FfmcClientService } from "./ffmc-client.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([CorporateClient, Branch, State]),
    UserModule,
  ],
  controllers: [FfmcClientController],
  providers: [FfmcClientService],
  exports: [FfmcClientService],
})
export class FfmcClientModule {}
