export const TransferRequestType = {
  COUNTER: "COUNTER",
  BRANCH: "BRANCH",
} as const;

export type TransferRequestType =
  (typeof TransferRequestType)[keyof typeof TransferRequestType];

export const TransferRequestStatus = {
  HELD: "HELD",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;

export type TransferRequestStatus =
  (typeof TransferRequestStatus)[keyof typeof TransferRequestStatus];

export const CurrencyTransferType = TransferRequestType;
export type CurrencyTransferType = TransferRequestType;

export const CurrencyTransferStatus = TransferRequestStatus;
export type CurrencyTransferStatus = TransferRequestStatus;
