import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentProfile } from './document-profile.entity';
import { DocumentProfileController } from './document-profile.controller';
import { DocumentProfileService } from './document-profile.service';
import { UserModule } from '../users/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentProfile]), UserModule],
  controllers: [DocumentProfileController],
  providers: [DocumentProfileService],
  exports: [DocumentProfileService],
})
export class DocumentProfileModule {}
