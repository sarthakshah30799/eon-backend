import { ApiProperty } from '@nestjs/swagger';
import { CurrencyRateSettings } from '../currency-rates.types';

export class CurrencyRateSettingsResponseDto {
  @ApiProperty()
  config: CurrencyRateSettings;
}
