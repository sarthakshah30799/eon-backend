import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TdsProfile } from './tds-profile.entity';
import { TdsProfileController } from './tds-profile.controller';
import { TdsProfileService } from './tds-profile.service';
import { UserModule } from '../users/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([TdsProfile]), UserModule],
  controllers: [TdsProfileController],
  providers: [TdsProfileService],
  exports: [TdsProfileService],
})
export class TdsProfileModule {}
