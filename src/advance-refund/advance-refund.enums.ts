export enum AdvanceRefundType {
  REFUND = "REFUND",
  KNOCK_OFF = "KNOCK_OFF",
}

export enum AdvanceRefundStatus {
  DRAFT = "DRAFT",
  PENDING_HO_APPROVAL = "PENDING_HO_APPROVAL",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum AdvanceRefundPayoutSource {
  LOCAL_BANK = "LOCAL_BANK",
  HO_PAYOUT = "HO_PAYOUT",
}

export enum AdvanceRefundPrintCopyType {
  CUSTOMER_COPY = "CUSTOMER_COPY",
  DUPLICATE_COPY = "DUPLICATE_COPY",
}

export const ADVANCE_REFUND_NUMBER_SERIES = "ADVANCE_REFUND";
