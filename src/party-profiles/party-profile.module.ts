import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PartyProfile } from "./party-profile.entity";
import { Branch } from "../branches/branch.entity";
import { State } from "../state/state.entity";
import { PartyProfileController } from "./party-profile.controller";
import { PartyProfileService } from "./party-profile.service";
import { UserModule } from "../users/user.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PartyProfile,
      Branch,
      State,
    ]),
    UserModule,
  ],
  controllers: [PartyProfileController],
  providers: [PartyProfileService],
  exports: [PartyProfileService],
})
export class PartyProfileModule {}
