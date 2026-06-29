import { PartialType } from '@nestjs/swagger';
import { CreateCurrencyRateGroupDto } from './create-currency-rate-group.dto';

export class UpdateCurrencyRateGroupDto extends PartialType(CreateCurrencyRateGroupDto) {}
