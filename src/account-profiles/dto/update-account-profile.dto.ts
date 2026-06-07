import { PartialType } from '@nestjs/swagger';
import { CreateAccountProfileDto } from './create-account-profile.dto';

export class UpdateAccountProfileDto extends PartialType(CreateAccountProfileDto) {}
