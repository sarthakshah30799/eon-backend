import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SelectOption } from "./category-option.entity";
import { SelectOptionController } from "./category-option.controller";
import { SelectOptionService } from "./category-option.service";
import { UserModule } from "../users/user.module";

@Module({
  imports: [TypeOrmModule.forFeature([SelectOption]), UserModule],
  controllers: [SelectOptionController],
  providers: [SelectOptionService],
  exports: [SelectOptionService],
})
export class SelectOptionModule {}
