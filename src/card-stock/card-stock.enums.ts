export const CardStockReceiptStatus = {
  POSTED: 'POSTED',
} as const;

export type CardStockReceiptStatus =
  (typeof CardStockReceiptStatus)[keyof typeof CardStockReceiptStatus];

export const CardStockCardStatus = {
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
} as const;

export type CardStockCardStatus =
  (typeof CardStockCardStatus)[keyof typeof CardStockCardStatus];

export const CardTransferStatus = {
  HELD: 'HELD',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

export type CardTransferStatus =
  (typeof CardTransferStatus)[keyof typeof CardTransferStatus];
