/**
 * Per-product TRANSACTION_ACCOUNTING setting codes for CC / CM / TT.
 * Closing was formerly named LOAD (Account Profile short codes CLOCC / CLOCM / CLOTT).
 */
export const PRODUCT_SELL_CONTROL_ACCOUNT_BY_CODE: Record<string, string> = {
  CC: "CARD_SELL_CONTROL_ACCOUNT",
  CM: "CM_SELL_CONTROL_ACCOUNT",
  TT: "TT_SELL_CONTROL_ACCOUNT",
};

export const PRODUCT_CLOSING_CONTROL_ACCOUNT_BY_CODE: Record<string, string> = {
  CC: "CARD_CLOSING_CONTROL_ACCOUNT",
  CM: "CM_CLOSING_CONTROL_ACCOUNT",
  TT: "TT_CLOSING_CONTROL_ACCOUNT",
};

export const PRODUCT_CONTROL_ACCOUNT_BY_CODE: Record<string, string> = {
  CC: "CARD_CONTROL_ACCOUNT",
  CM: "CM_CONTROL_ACCOUNT",
  TT: "TT_CONTROL_ACCOUNT",
};

export const PRODUCT_PURCHASE_CONTROL_ACCOUNT_BY_CODE: Record<string, string> = {
  CC: "CARD_PURCHASE_CONTROL_ACCOUNT",
  CM: "CM_PURCHASE_CONTROL_ACCOUNT",
  TT: "TT_PURCHASE_CONTROL_ACCOUNT",
};

export const PRODUCT_PROFIT_CONTROL_ACCOUNT_BY_CODE: Record<string, string> = {
  CC: "CARD_PROFIT_CONTROL_ACCOUNT",
  CM: "CM_PROFIT_CONTROL_ACCOUNT",
  TT: "TT_PROFIT_CONTROL_ACCOUNT",
};

export type ProductAccountSettingCodes = {
  sell: string;
  closing: string;
  control: string;
  purchase: string;
  profit: string;
};

export const normalizeProductAccountCode = (
  productCode?: string | null,
): string => String(productCode ?? "").trim().toUpperCase();

export const resolveProductAccountSettingCodes = (
  productCode?: string | null,
): ProductAccountSettingCodes => {
  const code = normalizeProductAccountCode(productCode);
  const sell = PRODUCT_SELL_CONTROL_ACCOUNT_BY_CODE[code];
  const closing = PRODUCT_CLOSING_CONTROL_ACCOUNT_BY_CODE[code];
  const control = PRODUCT_CONTROL_ACCOUNT_BY_CODE[code];
  const purchase = PRODUCT_PURCHASE_CONTROL_ACCOUNT_BY_CODE[code];
  const profit = PRODUCT_PROFIT_CONTROL_ACCOUNT_BY_CODE[code];
  if (!sell || !closing || !control || !purchase || !profit) {
    throw new Error(
      `Unsupported product code for control accounts: ${code || "(empty)"}`,
    );
  }
  return { sell, closing, control, purchase, profit };
};

export const resolveSellControlAccountSettingCode = (
  productCode?: string | null,
): string => resolveProductAccountSettingCodes(productCode).sell;
