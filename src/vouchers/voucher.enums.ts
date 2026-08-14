export enum VoucherType {
  RECEIPT = "RECEIPT",
  PAYMENT = "PAYMENT",
  JOURNAL = "JOURNAL",
}

export enum VoucherEntryDirection {
  DEBIT = "DEBIT",
  CREDIT = "CREDIT",
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

export const VOUCHER_NUMBER_SERIES: Record<VoucherType, string> = {
  [VoucherType.RECEIPT]: "RECEIPT_VOUCHER",
  [VoucherType.PAYMENT]: "PAYMENT_VOUCHER",
  [VoucherType.JOURNAL]: "JOURNAL_VOUCHER",
};
