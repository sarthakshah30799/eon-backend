import { CurrencyRateMarginType, CurrencyRateProvider } from './currency-rates.enums';

export interface CurrencyRateMarginConfig {
  marginType: CurrencyRateMarginType | '';
  marginValue: string | null;
  minRate: string | null;
  maxRate: string | null;
}

export interface CurrencyRateRuleConfig {
  buy: CurrencyRateMarginConfig;
  sale: CurrencyRateMarginConfig;
}

export interface ProductCurrencyPricingRule extends CurrencyRateRuleConfig {
  id: string;
  productId: string;
  currencyId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  product?: { id: string; productCode: string; productDescription: string } | null;
  currency?: { id: string; currencyCode: string; currencyName: string } | null;
}

export interface CurrencyRateQuoteSide {
  baseRate: string;
  marginAmount: string;
  finalRate: string;
  minRate: string;
  maxRate: string;
  isValid: boolean;
  reason?: string;
}

export interface CurrencyRateQuote {
  productId: string;
  productCode: string;
  currencyId: string;
  currencyCode: string;
  provider: CurrencyRateProvider;
  baseBuyRate: string;
  baseSaleRate: string;
  buy: CurrencyRateQuoteSide;
  sale: CurrencyRateQuoteSide;
  effectiveSource: 'product-override' | 'group-default';
  effectiveGroupCode: string | null;
}
