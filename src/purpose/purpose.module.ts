import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../users/user.module';
import { Purpose } from './purpose.entity';
import { PurposeSlab } from './purpose-slab.entity';
import { PurposeController } from './purpose.controller';
import { PurposeService } from './purpose.service';

@Module({
  imports: [TypeOrmModule.forFeature([Purpose, PurposeSlab]), UserModule],
  controllers: [PurposeController],
  providers: [PurposeService],
  exports: [PurposeService],
})
export class PurposeModule {}
