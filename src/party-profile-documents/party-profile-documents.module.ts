import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartyProfile } from '../party-profiles/party-profile.entity';
import { DocumentProfile } from '../document-profiles/document-profile.entity';
import { SelectOption } from '../category-options/category-option.entity';
import { PartyProfileDocument } from './party-profile-document.entity';
import { PartyProfileDocumentFile } from './party-profile-document-file.entity';
import { PartyProfileDocumentsController } from './party-profile-documents.controller';
import { PartyProfileDocumentsService } from './party-profile-documents.service';
import { UserModule } from '../users/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PartyProfile,
      DocumentProfile,
      SelectOption,
      PartyProfileDocument,
      PartyProfileDocumentFile,
    ]),
    UserModule,
  ],
  controllers: [PartyProfileDocumentsController],
  providers: [PartyProfileDocumentsService],
  exports: [PartyProfileDocumentsService],
})
export class PartyProfileDocumentsModule {}
