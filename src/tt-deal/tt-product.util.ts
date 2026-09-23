export const TT_PRODUCT_CODE = "TT";

export const normalizeProductCode = (productCode?: string | null): string =>
  String(productCode ?? "").toUpperCase();

export const isTtProductCode = (productCode?: string | null): boolean =>
  normalizeProductCode(productCode) === TT_PRODUCT_CODE;
