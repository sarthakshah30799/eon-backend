export const CurrencyRateProvider = {
  TICKER: 'TICKER',
  FOREX: 'FOREX',
  MANUAL: 'MANUAL',
} as const;

export type CurrencyRateProvider =
  (typeof CurrencyRateProvider)[keyof typeof CurrencyRateProvider];

export const CurrencyRateMarginType = {
  PERCENT: 'PERCENT',
  RATE: 'RATE',
} as const;

export type CurrencyRateMarginType =
  (typeof CurrencyRateMarginType)[keyof typeof CurrencyRateMarginType];
