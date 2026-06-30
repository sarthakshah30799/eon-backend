import { ApiProperty } from '@nestjs/swagger';
import { CurrencyRateMarginType } from '../currency-rates.enums';
import { ProductCurrencyPricingRule } from '../currency-rates.types';

class CurrencyRateMarginResponseDto {
  @ApiProperty({ enum: CurrencyRateMarginType })
  marginType: CurrencyRateMarginType;

  @ApiProperty()
  marginValue: string;

  @ApiProperty()
  minRate: string;

  @ApiProperty()
  maxRate: string;
}

class ProductSummaryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productCode: string;

  @ApiProperty()
  productDescription: string;
}

class CurrencySummaryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  currencyCode: string;

  @ApiProperty()
  currencyName: string;
}

export class ProductCurrencyRateResponseDto implements ProductCurrencyPricingRule {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty()
  currencyId: string;

  @ApiProperty({ type: () => CurrencyRateMarginResponseDto })
  buy: CurrencyRateMarginResponseDto;

  @ApiProperty({ type: () => CurrencyRateMarginResponseDto })
  sale: CurrencyRateMarginResponseDto;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ type: () => ProductSummaryResponseDto, required: false })
  product?: ProductSummaryResponseDto | null;

  @ApiProperty({ type: () => CurrencySummaryResponseDto, required: false })
  currency?: CurrencySummaryResponseDto | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}
