export const TransactionStatus = {
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type TransactionStatus =
  (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const TransactionType = {
  SALE: "SALE",
  PURCHASE: "PURCHASE",
} as const;

export type TransactionType =
  (typeof TransactionType)[keyof typeof TransactionType];

export const TransactionTypeProfileEnum = {
  PURCHASE_FFMC: "PURCHASE_FFMC",
  PURCHASE_CORPORATE: "PURCHASE_CORPORATE",
  PURCHASE_INDIVIDUAL: "PURCHASE_INDIVIDUAL",
  SALE_CORPORATE: "SALE_CORPORATE",
  SALE_INDIVIDUAL: "SALE_INDIVIDUAL",
  SALE_FFMC: "SALE_FFMC",
  SALE_RMC: "SALE_RMC",
  SALE_FOREX: "SALE_FOREX",
  SALE_FOREIGN: "SALE_FOREIGN",
  SALE_MISC: "SALE_MISC",
  SALE_FRANCHISE: "SALE_FRANCHISE",
  PURCHASE_RMC: "PURCHASE_RMC",
  PURCHASE_FOREX: "PURCHASE_FOREX",
  PURCHASE_FOREIGN: "PURCHASE_FOREIGN",
  PURCHASE_MISC: "PURCHASE_MISC",
  PURCHASE_FRANCHISE: "PURCHASE_FRANCHISE",
} as const;

export type TransactionTypeProfile =
  (typeof TransactionTypeProfileEnum)[keyof typeof TransactionTypeProfileEnum];

export const TradeMode = {
  BULK: "BULK",
  RETAIL: "RETAIL",
} as const;

export type TradeMode = (typeof TradeMode)[keyof typeof TradeMode];

export const TransactionDocumentStatus = {
  PENDING: "PENDING",
  ATTACHED: "ATTACHED",
  REMOVED: "REMOVED",
} as const;

export type TransactionDocumentStatus =
  (typeof TransactionDocumentStatus)[keyof typeof TransactionDocumentStatus];

export const TransactionPaymentMethod = {
  CASH: "CASH",
  CHEQUE: "CHEQUE",
  BANK_TRANSFER: "BANK_TRANSFER",
  UPI: "UPI",
  NEFT: "NEFT",
  RTGS: "RTGS",
  IMPS: "IMPS",
  CARD: "CARD",
  OTHER: "OTHER",
} as const;

export type TransactionPaymentMethod =
  (typeof TransactionPaymentMethod)[keyof typeof TransactionPaymentMethod];

export const TransactionPaymentDirection = {
  PAYMENT: "PAYMENT",
  RECEIPT: "RECEIPT",
} as const;

export type TransactionPaymentDirection =
  (typeof TransactionPaymentDirection)[keyof typeof TransactionPaymentDirection];

export const TransactionPostingDirection = {
  DEBIT: "DEBIT",
  CREDIT: "CREDIT",
} as const;

export type TransactionPostingDirection =
  (typeof TransactionPostingDirection)[keyof typeof TransactionPostingDirection];

export const TransactionPostingSourceType = {
  ITEM: "ITEM",
  ITEM_PROFIT: "ITEM_PROFIT",
  ITEM_SALE: "ITEM_SALE",
  ROUND_OFF: "ROUND_OFF",
  PARTY_CONTROL: "PARTY_CONTROL",
  ADDITIONAL_CHARGE: "ADDITIONAL_CHARGE",
  TAX_ITEM: "TAX_ITEM",
  TAX_ADDITIONAL_CHARGE: "TAX_ADDITIONAL_CHARGE",
  PAYMENT: "PAYMENT",
} as const;

export type TransactionPostingSourceType =
  (typeof TransactionPostingSourceType)[keyof typeof TransactionPostingSourceType];

export const TransactionTaxSplitMode = {
  CGST_SGST: "CGST_SGST",
  IGST: "IGST",
} as const;

export type TransactionTaxSplitMode =
  (typeof TransactionTaxSplitMode)[keyof typeof TransactionTaxSplitMode];

export const TransactionEventType = {
  ACCOUNT_POSTINGS_REBUILD: "ACCOUNT_POSTINGS_REBUILD",
} as const;

export type TransactionEventType =
  (typeof TransactionEventType)[keyof typeof TransactionEventType];

export const TransactionEventStatus = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  PROCESSED: "PROCESSED",
  FAILED: "FAILED",
} as const;

export type TransactionEventStatus =
  (typeof TransactionEventStatus)[keyof typeof TransactionEventStatus];

export const TransactionLogAction = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  SUBMIT: "SUBMIT",
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  VERSION_CREATE: "VERSION_CREATE",
  DOCUMENT_UPDATE: "DOCUMENT_UPDATE",
  ADDITIONAL_CHARGE_UPDATE: "ADDITIONAL_CHARGE_UPDATE",
  PAYMENT_UPDATE: "PAYMENT_UPDATE",
  PRINT: "PRINT",
} as const;

export type TransactionLogAction =
  (typeof TransactionLogAction)[keyof typeof TransactionLogAction];

export enum TransactionProfileType {
  AD1 = "AD1",
}
