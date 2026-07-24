import { PartialType } from '@nestjs/swagger';
import { CreatePurposeDto } from './create-purpose.dto';

export class UpdatePurposeDto extends PartialType(CreatePurposeDto) {}
