import {
  CurrencyRateMarginDirection,
  CurrencyRateMarginType,
  CurrencyRateProvider,
} from './currency-rates.enums';

export interface CurrencyRateMarginConfig {
  marginType: CurrencyRateMarginType;
  marginValue: string;
  marginDirection: CurrencyRateMarginDirection;
  minRate: string;
  maxRate: string;
}

export interface CurrencyRateRuleConfig {
  buy: CurrencyRateMarginConfig;
  sale: CurrencyRateMarginConfig;
}

export interface CurrencyRateSettings {
  defaultProvider: CurrencyRateProvider;
  roundingScale: number;
  global: CurrencyRateRuleConfig;
  groups: Record<string, CurrencyRateRuleConfig>;
  currencyOverrides: Record<string, CurrencyRateRuleConfig>;
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
  effectiveSource: 'currency-override' | 'group-default' | 'global-default';
}
