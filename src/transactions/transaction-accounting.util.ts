import { AccountProfile } from "../account-profiles/account-profile.entity";
import { Product } from "../products/product.entity";
import { TradeMode, TransactionType } from "./transactions.enums";

type ProductAccountKey =
  | "bulkPurAc"
  | "purchaseAc"
  | "branchPurAc"
  | "bulkSaleAc"
  | "saleAc"
  | "branchSaleAc"
  | "bulkProficAc"
  | "profitAc"
  | "profitAcBrnSale";

type ProductAccountResolveOptions = {
  useBranchAccounts?: boolean;
};

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

const BRANCH_ACCOUNT_KEY_PRIORITY: Record<
  TransactionType,
  Record<TradeMode, readonly ProductAccountKey[]>
> = {
  [TransactionType.PURCHASE]: {
    [TradeMode.BULK]: ["branchPurAc", "bulkPurAc", "purchaseAc"],
    [TradeMode.RETAIL]: ["branchPurAc", "purchaseAc", "bulkPurAc"],
  },
  [TransactionType.SALE]: {
    [TradeMode.BULK]: ["branchSaleAc", "bulkSaleAc", "saleAc"],
    [TradeMode.RETAIL]: ["branchSaleAc", "saleAc", "bulkSaleAc"],
  },
};

const PROFIT_ACCOUNT_PRIORITY: Record<TradeMode, readonly ProductAccountKey[]> = {
  [TradeMode.BULK]: ["bulkProficAc", "profitAc"],
  [TradeMode.RETAIL]: ["profitAc", "bulkProficAc"],
};

const BRANCH_PROFIT_ACCOUNT_PRIORITY: Record<TradeMode, readonly ProductAccountKey[]> = {
  [TradeMode.BULK]: ["profitAcBrnSale", "bulkProficAc", "profitAc"],
  [TradeMode.RETAIL]: ["profitAcBrnSale", "profitAc", "bulkProficAc"],
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
  options: ProductAccountResolveOptions = {},
): AccountProfile | null {
  const keys =
    kind === "profit"
      ? options.useBranchAccounts
        ? BRANCH_PROFIT_ACCOUNT_PRIORITY[tradeMode]
        : PROFIT_ACCOUNT_PRIORITY[tradeMode]
      : options.useBranchAccounts
        ? BRANCH_ACCOUNT_KEY_PRIORITY[transactionType][tradeMode]
        : ACCOUNT_KEY_PRIORITY[transactionType][tradeMode];

  return firstDefinedAccount(product, keys);
}

export function resolveProductTransactionAccountField(
  transactionType: TransactionType,
  tradeMode: TradeMode,
  kind: "purchase" | "sale" | "profit",
  options: ProductAccountResolveOptions = {},
): ProductAccountKey {
  const keys =
    kind === "profit"
      ? options.useBranchAccounts
        ? BRANCH_PROFIT_ACCOUNT_PRIORITY[tradeMode]
        : PROFIT_ACCOUNT_PRIORITY[tradeMode]
      : options.useBranchAccounts
        ? BRANCH_ACCOUNT_KEY_PRIORITY[transactionType][tradeMode]
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
