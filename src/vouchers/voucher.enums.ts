import { TransactionTypeProfileEnum } from "../transactions/transactions.enums";

export enum VoucherType {
  RECEIPT = "RECEIPT",
  PAYMENT = "PAYMENT",
  JOURNAL = "JOURNAL",
  DEPOSIT_WITHDRAWAL = "DEPOSIT_WITHDRAWAL",
  ADVICE = "ADVICE",
}

export enum VoucherEntryDirection {
  DEBIT = "DEBIT",
  CREDIT = "CREDIT",
}

export enum VoucherAdviceRole {
  ISSUER = "ISSUER",
  HONOUR = "HONOUR",
}

export enum VoucherAdviceStatus {
  PENDING_HONOUR = "PENDING_HONOUR",
  HONOURED = "HONOURED",
}

export enum VoucherAccountMode {
  CASH = "CASH",
  BANK_CHEQUE = "BANK_CHEQUE",
  PETTY_CASH = "PETTY_CASH",
  CREDIT_CARD = "CREDIT_CARD",
}

export enum VoucherAdvanceApplicationState {
  RESERVED = "RESERVED",
  APPLIED = "APPLIED",
  RELEASED = "RELEASED",
}

export enum TransactionSettlementSource {
  NORMAL = "NORMAL",
  ADVANCE = "ADVANCE",
}

export enum VoucherPostingSourceType {
  HEADER = "HEADER",
  ITEM = "ITEM",
}

export const VoucherEventType = {
  ACCOUNT_POSTINGS_REBUILD: "ACCOUNT_POSTINGS_REBUILD",
} as const;

export type VoucherEventType =
  (typeof VoucherEventType)[keyof typeof VoucherEventType];

export const VoucherEventStatus = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  PROCESSED: "PROCESSED",
  FAILED: "FAILED",
} as const;

export type VoucherEventStatus =
  (typeof VoucherEventStatus)[keyof typeof VoucherEventStatus];

/** Misc VOUCHER_ITEM_TYPE values: Account + party purchase/sale profiles. */
export const VoucherItemTypeValue = {
  ACCOUNT: "ACCOUNT",
  PURCHASE_FFMC: TransactionTypeProfileEnum.PURCHASE_FFMC,
  PURCHASE_CORPORATE_INDIVIDUAL:
    TransactionTypeProfileEnum.PURCHASE_CORPORATE_INDIVIDUAL,
  PURCHASE_RMC: TransactionTypeProfileEnum.PURCHASE_RMC,
  PURCHASE_FOREX: TransactionTypeProfileEnum.PURCHASE_FOREX,
  PURCHASE_FOREIGN: TransactionTypeProfileEnum.PURCHASE_FOREIGN,
  PURCHASE_MISC: TransactionTypeProfileEnum.PURCHASE_MISC,
  PURCHASE_FRANCHISE: TransactionTypeProfileEnum.PURCHASE_FRANCHISE,
  SALE_CORPORATE_INDIVIDUAL:
    TransactionTypeProfileEnum.SALE_CORPORATE_INDIVIDUAL,
  SALE_FFMC: TransactionTypeProfileEnum.SALE_FFMC,
  SALE_RMC: TransactionTypeProfileEnum.SALE_RMC,
  SALE_FOREX: TransactionTypeProfileEnum.SALE_FOREX,
  SALE_FOREIGN: TransactionTypeProfileEnum.SALE_FOREIGN,
  SALE_MISC: TransactionTypeProfileEnum.SALE_MISC,
  SALE_FRANCHISE: TransactionTypeProfileEnum.SALE_FRANCHISE,
} as const;

export type VoucherItemTypeValue =
  (typeof VoucherItemTypeValue)[keyof typeof VoucherItemTypeValue];

export const VOUCHER_ITEM_TYPE_LABELS: Record<VoucherItemTypeValue, string> = {
  [VoucherItemTypeValue.ACCOUNT]: "Account",
  [VoucherItemTypeValue.PURCHASE_FFMC]: "Purchase FFMC",
  [VoucherItemTypeValue.PURCHASE_CORPORATE_INDIVIDUAL]:
    "Purchase (Corporate/Individual)",
  [VoucherItemTypeValue.PURCHASE_RMC]: "Purchase RMC",
  [VoucherItemTypeValue.PURCHASE_FOREX]: "Purchase Forex",
  [VoucherItemTypeValue.PURCHASE_FOREIGN]: "Purchase Foreign",
  [VoucherItemTypeValue.PURCHASE_MISC]: "Purchase Misc",
  [VoucherItemTypeValue.PURCHASE_FRANCHISE]: "Purchase Franchise",
  [VoucherItemTypeValue.SALE_CORPORATE_INDIVIDUAL]:
    "Sell (Corporate/Individual)",
  [VoucherItemTypeValue.SALE_FFMC]: "Sell FFMC",
  [VoucherItemTypeValue.SALE_RMC]: "Sell RMC",
  [VoucherItemTypeValue.SALE_FOREX]: "Sell Forex",
  [VoucherItemTypeValue.SALE_FOREIGN]: "Sell Foreign",
  [VoucherItemTypeValue.SALE_MISC]: "Sell Misc",
  [VoucherItemTypeValue.SALE_FRANCHISE]: "Sell Franchise",
};

export const isVoucherAccountItemType = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toUpperCase() === VoucherItemTypeValue.ACCOUNT;

export const isVoucherBillItemType = (value: unknown) => {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  return (
    normalized.startsWith("PURCHASE_") || normalized.startsWith("SALE_")
  ) && Object.values(VoucherItemTypeValue).includes(normalized as VoucherItemTypeValue);
};

export const voucherBillTransactionType = (
  value: unknown,
): "PURCHASE" | "SALE" | null => {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  if (normalized.startsWith("PURCHASE_")) return "PURCHASE";
  if (normalized.startsWith("SALE_")) return "SALE";
  return null;
};

export const VOUCHER_NUMBER_SERIES: Record<VoucherType, string> = {
  [VoucherType.RECEIPT]: "RECEIPT_VOUCHER",
  [VoucherType.PAYMENT]: "PAYMENT_VOUCHER",
  [VoucherType.JOURNAL]: "JOURNAL_VOUCHER",
  [VoucherType.DEPOSIT_WITHDRAWAL]: "DEPOSIT_WITHDRAWAL_VOUCHER",
  [VoucherType.ADVICE]: "ADVICE_VOUCHER",
};
