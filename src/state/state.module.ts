import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { State } from "./state.entity";

@Module({
  imports: [TypeOrmModule.forFeature([State])],
})
export class StateModule {}
