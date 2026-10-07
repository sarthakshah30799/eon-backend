/** Legacy default surrender product code — prefer maintainBlankStockOfProduct. */
export const EM_PRODUCT_CODE = "EM";
export const SINGLE_CURRENCY_CARD_PRODUCT_CODE = "CC";
export const MULTI_CURRENCY_CARD_PRODUCT_CODE = "CM";
export const CN_PRODUCT_CODE = "CN";
export const TT_PRODUCT_CODE = "TT";

export const CARD_PRODUCT_CODES = [
  SINGLE_CURRENCY_CARD_PRODUCT_CODE,
  MULTI_CURRENCY_CARD_PRODUCT_CODE,
] as const;

export type CardProductCode = (typeof CARD_PRODUCT_CODES)[number];

export type SurrenderProductLike = {
  productCode?: string | null;
  maintainBlankStockOfProduct?: boolean | null;
  availableInRetailBuying?: boolean | null;
  availableInBulkBuying?: boolean | null;
  availableInBulkSelling?: boolean | null;
  /** Linked CARD issuers on the product profile (API / form shape). */
  issuerProfileIds?: string[] | null;
  /** TypeORM relation when loaded. */
  issuerLinks?: unknown[] | null;
  /** Form-row convenience when issuer ids are not on the row. */
  hasIssuerLinks?: boolean | null;
};

export type ProductSnapshotLike = {
  productCode?: string | null;
  product_code?: string | null;
  code?: string | null;
  maintainBlankStockOfProduct?: boolean | null;
  maintain_blank_stock_of_product?: boolean | null;
};

export const normalizeProductCode = (productCode?: string | null): string =>
  String(productCode ?? "").toUpperCase();

export const isCardProductCode = (productCode?: string | null): boolean =>
  CARD_PRODUCT_CODES.includes(
    normalizeProductCode(productCode) as CardProductCode,
  );

/** @deprecated Prefer maintainBlankStockOfProduct / isSurrenderMenuProduct. */
export const isEmProductCode = (productCode?: string | null): boolean =>
  normalizeProductCode(productCode) === EM_PRODUCT_CODE;

export const isCnProductCode = (productCode?: string | null): boolean =>
  normalizeProductCode(productCode) === CN_PRODUCT_CODE;

export const isTtProductCode = (productCode?: string | null): boolean =>
  normalizeProductCode(productCode) === TT_PRODUCT_CODE;

/** Linked issuers required for surrender punch (sold CARD / issuer sale). */
export const hasSurrenderIssuerLinks = (
  product: SurrenderProductLike,
): boolean => {
  if (product.hasIssuerLinks === true) return true;
  if ((product.issuerProfileIds?.length ?? 0) > 0) return true;
  if ((product.issuerLinks?.length ?? 0) > 0) return true;
  return false;
};

/** @deprecated Prefer hasSurrenderIssuerLinks. */
export const hasSurrenderIssuerPath = hasSurrenderIssuerLinks;

/**
 * Surrender product from Product Profile (data-driven, no product-code list):
 * blank stock off + linked issuers + retail buying + bulk selling.
 * Matches EM-style masters; CN (no issuers) and CC/CM (blank stock on) stay out.
 */
export const isSurrenderMenuProduct = (
  product: SurrenderProductLike,
): boolean =>
  product.maintainBlankStockOfProduct === false &&
  hasSurrenderIssuerLinks(product) &&
  product.availableInRetailBuying === true &&
  product.availableInBulkSelling === true;

/** Retail surrender purchase uses the same profile definition. */
export const isSurrenderBuyingProduct = (
  product: SurrenderProductLike,
): boolean => isSurrenderMenuProduct(product);

/** HO bulk issuer sale uses the same profile definition. */
export const isSurrenderBulkSaleProduct = (
  product: SurrenderProductLike,
): boolean => isSurrenderMenuProduct(product);

/**
 * Snapshot for surrender units. Prefer maintainBlankStockOfProduct;
 * fall back to legacy productCode EM when the flag was not snapshotted.
 */
export const isSurrenderUnitSnapshot = (
  snapshot: ProductSnapshotLike | null | undefined,
): boolean => {
  if (!snapshot || typeof snapshot !== "object") return false;
  const flag =
    snapshot.maintainBlankStockOfProduct ??
    snapshot.maintain_blank_stock_of_product;
  if (typeof flag === "boolean") return flag === false;
  return isEmProductCode(
    snapshot.productCode ?? snapshot.product_code ?? snapshot.code,
  );
};

export const buildSurrenderProductSnapshot = (product: {
  id: string;
  productCode: string;
  productDescription: string;
  maintainBlankStockOfProduct?: boolean | null;
}): ProductSnapshotLike & {
  id: string;
  productDescription: string;
  name: string;
  label: string;
} => ({
  id: product.id,
  productCode: product.productCode,
  productDescription: product.productDescription,
  code: product.productCode,
  name: product.productDescription,
  label: `${product.productCode} - ${product.productDescription}`,
  maintainBlankStockOfProduct: product.maintainBlankStockOfProduct === false,
});

export const isBlankStockCardProductCode = (
  productCode?: string | null,
): boolean => isCardProductCode(productCode);

export const isMultiCurrencyCardProduct = (
  productCode?: string | null,
): boolean =>
  normalizeProductCode(productCode) === MULTI_CURRENCY_CARD_PRODUCT_CODE;

export const isSingleCurrencyCardProduct = (
  productCode?: string | null,
): boolean =>
  normalizeProductCode(productCode) === SINGLE_CURRENCY_CARD_PRODUCT_CODE;
