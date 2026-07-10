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
  SALE_FFMC: "SALE_FFMC",
  PURCHASE_RMC: "PURCHASE_RMC",
  PURCHASE_FOREX: "PURCHASE_FOREX",
  PURCHASE_FOREIGN: "PURCHASE_FOREIGN",
  PURCHASE_MISC: "PURCHASE_MISC",
  PURCHASE_FRANCHISE: "PURCHASE_FRANCHISE",
} as const;

export type TransactionTypeProfile =
  (typeof TransactionTypeProfileEnum)[keyof typeof TransactionTypeProfileEnum];

export const TransactionDocumentContext = {
  PURCHASE_FFMC: "PURCHASE_FFMC",
  PURCHASE_AUTHORISED_DEALER: "PURCHASE_AUTHORISED_DEALER",
  PURCHASE_CORPORATE_CLIENT: "PURCHASE_CORPORATE_CLIENT",
  PURCHASE_RMC: "PURCHASE_RMC",
  SALE_FFMC: "SALE_FFMC",
  SALE_AUTHORISED_DEALER: "SALE_AUTHORISED_DEALER",
  SALE_CORPORATE_CLIENT: "SALE_CORPORATE_CLIENT",
  SALE_RMC: "SALE_RMC",
} as const;

export type TransactionDocumentContext =
  (typeof TransactionDocumentContext)[keyof typeof TransactionDocumentContext];

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
