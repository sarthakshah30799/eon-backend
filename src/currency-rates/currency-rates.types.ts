import { CurrencyRateMarginType, CurrencyRateProvider } from './currency-rates.enums';

export interface CurrencyRateSettings {
  defaultProvider: CurrencyRateProvider;
  buyMarginType: CurrencyRateMarginType;
  buyMarginValue: string;
  buyMinRate: string;
  buyMaxRate: string;
  saleMarginType: CurrencyRateMarginType;
  saleMarginValue: string;
  saleMinRate: string;
  saleMaxRate: string;
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
  currencyId: string;
  currencyCode: string;
  provider: CurrencyRateProvider;
  baseBuyRate: string;
  baseSaleRate: string;
  buy: CurrencyRateQuoteSide;
  sale: CurrencyRateQuoteSide;
  effectiveSource: 'advanced-settings' | 'currency-override' | 'group-default' | 'global-default';
}
