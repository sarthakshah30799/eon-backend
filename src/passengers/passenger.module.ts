import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassengerController } from './passenger.controller';
import { PassengerService } from './passenger.service';
import { Passenger } from './passenger.entity';
import { PassengerTravel } from './passenger-travel.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Passenger, PassengerTravel])],
  controllers: [PassengerController],
  providers: [PassengerService],
  exports: [PassengerService],
})
export class PassengerModule {}
