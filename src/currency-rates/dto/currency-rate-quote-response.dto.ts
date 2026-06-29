import { ApiProperty } from '@nestjs/swagger';
import { CurrencyRateProvider } from '../currency-rates.enums';
import { CurrencyRateQuote, CurrencyRateQuoteSide } from '../currency-rates.types';

class CurrencyRateQuoteSideResponseDto implements CurrencyRateQuoteSide {
  @ApiProperty()
  baseRate: string;

  @ApiProperty()
  marginAmount: string;

  @ApiProperty()
  finalRate: string;

  @ApiProperty()
  minRate: string;

  @ApiProperty()
  maxRate: string;

  @ApiProperty()
  isValid: boolean;

  @ApiProperty({ required: false })
  reason?: string;
}

export class CurrencyRateQuoteResponseDto implements CurrencyRateQuote {
  @ApiProperty()
  currencyId: string;

  @ApiProperty()
  currencyCode: string;

  @ApiProperty()
  provider: CurrencyRateProvider;

  @ApiProperty()
  baseBuyRate: string;

  @ApiProperty()
  baseSaleRate: string;

  @ApiProperty({ type: () => CurrencyRateQuoteSideResponseDto })
  buy: CurrencyRateQuoteSideResponseDto;

  @ApiProperty({ type: () => CurrencyRateQuoteSideResponseDto })
  sale: CurrencyRateQuoteSideResponseDto;

  @ApiProperty()
  effectiveSource: 'advanced-settings' | 'currency-override' | 'group-default' | 'global-default';

  static fromValue(value: CurrencyRateQuote): CurrencyRateQuoteResponseDto {
    return Object.assign(new CurrencyRateQuoteResponseDto(), value);
  }
}
