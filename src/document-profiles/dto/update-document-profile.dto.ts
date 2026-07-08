import { PartialType } from '@nestjs/swagger';
import { CreateDocumentProfileDto } from './create-document-profile.dto';

export class UpdateDocumentProfileDto extends PartialType(
  CreateDocumentProfileDto,
) {}

