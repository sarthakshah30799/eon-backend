export enum CreditRequestFundStatus {
  PENDING = "PENDING",
  APPROVE = "APPROVE",
  REJECT = "REJECT",
  CANCELLED = "CANCELLED",
}

export enum CreditRequestFundPrintCopyType {
  CUSTOMER_COPY = "CUSTOMER_COPY",
  DUPLICATE_COPY = "DUPLICATE_COPY",
}

export const CreditRequestFundLogAction = {
  CREATE: "CREATE",
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  CANCEL: "CANCEL",
  PRINT: "PRINT",
} as const;

export type CreditRequestFundLogAction =
  (typeof CreditRequestFundLogAction)[keyof typeof CreditRequestFundLogAction];

export const CREDIT_REQUEST_FUND_NUMBER_SERIES = "CREDIT_REQUEST_FUND";
