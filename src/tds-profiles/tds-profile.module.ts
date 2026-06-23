import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TdsProfile } from './tds-profile.entity';
import { TdsProfileController } from './tds-profile.controller';
import { TdsProfileService } from './tds-profile.service';

@Module({
  imports: [TypeOrmModule.forFeature([TdsProfile])],
  controllers: [TdsProfileController],
  providers: [TdsProfileService],
  exports: [TdsProfileService],
})
export class TdsProfileModule {}
