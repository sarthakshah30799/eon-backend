export const SINGLE_CURRENCY_CARD_PRODUCT_CODE = "CC";
export const MULTI_CURRENCY_CARD_PRODUCT_CODE = "CM";

export const CARD_PRODUCT_CODES = [
  SINGLE_CURRENCY_CARD_PRODUCT_CODE,
  MULTI_CURRENCY_CARD_PRODUCT_CODE,
] as const;

export type CardProductCode = (typeof CARD_PRODUCT_CODES)[number];

export const normalizeProductCode = (productCode?: string | null): string =>
  String(productCode ?? "").toUpperCase();

export const isCardProductCode = (productCode?: string | null): boolean =>
  CARD_PRODUCT_CODES.includes(
    normalizeProductCode(productCode) as CardProductCode,
  );

export const isMultiCurrencyCardProduct = (
  productCode?: string | null,
): boolean =>
  normalizeProductCode(productCode) === MULTI_CURRENCY_CARD_PRODUCT_CODE;

export const isSingleCurrencyCardProduct = (
  productCode?: string | null,
): boolean =>
  normalizeProductCode(productCode) === SINGLE_CURRENCY_CARD_PRODUCT_CODE;
