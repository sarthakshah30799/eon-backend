import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserModule } from "../users/user.module";
import { Purpose } from "./purpose.entity";
import { PurposeSlab } from "./purpose-slab.entity";
import { PurposeGroup } from "./purpose-group.entity";
import { PurposeGroupPurpose } from "./purpose-group-purpose.entity";
import { PurposeController } from "./purpose.controller";
import { PurposeGroupController } from "./purpose-group.controller";
import { PurposeService } from "./purpose.service";
import { PurposeGroupService } from "./purpose-group.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Purpose,
      PurposeSlab,
      PurposeGroup,
      PurposeGroupPurpose,
    ]),
    UserModule,
  ],
  controllers: [PurposeController, PurposeGroupController],
  providers: [PurposeService, PurposeGroupService],
  exports: [PurposeService, PurposeGroupService],
})
export class PurposeModule {}
