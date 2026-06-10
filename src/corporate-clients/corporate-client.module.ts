import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CorporateClient } from "./corporate-client.entity";
import { Branch } from "../branches/branch.entity";
import { State } from "../state/state.entity";
import { CorporateClientController } from "./corporate-client.controller";
import { CorporateClientService } from "./corporate-client.service";
import { UserModule } from "../users/user.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CorporateClient,
      Branch,
      State,
    ]),
    UserModule,
  ],
  controllers: [CorporateClientController],
  providers: [CorporateClientService],
  exports: [CorporateClientService],
})
export class CorporateClientModule {}
