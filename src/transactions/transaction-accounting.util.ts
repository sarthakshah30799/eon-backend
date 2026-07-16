import { AccountProfile } from "../account-profiles/account-profile.entity";
import { Product } from "../products/product.entity";
import { TradeMode, TransactionType } from "./transactions.enums";

type ProductAccountKey = "bulkPurAc" | "purchaseAc" | "bulkSaleAc" | "saleAc" | "bulkProficAc" | "profitAc";

const ACCOUNT_KEY_PRIORITY: Record<
  TransactionType,
  Record<TradeMode, readonly ProductAccountKey[]>
> = {
  [TransactionType.PURCHASE]: {
    [TradeMode.BULK]: ["bulkPurAc", "purchaseAc"],
    [TradeMode.RETAIL]: ["purchaseAc", "bulkPurAc"],
  },
  [TransactionType.SALE]: {
    [TradeMode.BULK]: ["bulkSaleAc", "saleAc"],
    [TradeMode.RETAIL]: ["saleAc", "bulkSaleAc"],
  },
};

const PROFIT_ACCOUNT_PRIORITY: Record<TradeMode, readonly ProductAccountKey[]> = {
  [TradeMode.BULK]: ["bulkProficAc", "profitAc"],
  [TradeMode.RETAIL]: ["profitAc", "bulkProficAc"],
};

const ACCOUNT_KIND_LABEL: Record<"purchase" | "sale" | "profit", string> = {
  purchase: "purchase",
  sale: "sale",
  profit: "profit",
};

function firstDefinedAccount(
  product: Product,
  keys: readonly ProductAccountKey[],
): AccountProfile | null {
  for (const key of keys) {
    const value = product[key];
    if (value) {
      return value;
    }
  }

  return null;
}

export function resolveProductTransactionAccount(
  product: Product,
  transactionType: TransactionType,
  tradeMode: TradeMode,
  kind: "purchase" | "sale" | "profit",
): AccountProfile | null {
  const keys =
    kind === "profit"
      ? PROFIT_ACCOUNT_PRIORITY[tradeMode]
      : ACCOUNT_KEY_PRIORITY[transactionType][tradeMode];

  return firstDefinedAccount(product, keys);
}

export function resolveProductTransactionAccountField(
  transactionType: TransactionType,
  tradeMode: TradeMode,
  kind: "purchase" | "sale" | "profit",
): ProductAccountKey {
  const keys =
    kind === "profit"
      ? PROFIT_ACCOUNT_PRIORITY[tradeMode]
      : ACCOUNT_KEY_PRIORITY[transactionType][tradeMode];

  return keys[0];
}

export function getTransactionAccountKindLabel(kind: "purchase" | "sale" | "profit") {
  return ACCOUNT_KIND_LABEL[kind];
}

export function roundToScale(value: number, scale: number): string {
  return Number.isFinite(value) ? value.toFixed(scale) : (0).toFixed(scale);
}

export function toPositiveAmount(value: number): string {
  return Math.abs(value).toFixed(2);
}

export function roundMoney(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

