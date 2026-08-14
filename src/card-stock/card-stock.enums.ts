export const CardStockReceiptStatus = {
  POSTED: 'POSTED',
} as const;

export type CardStockReceiptStatus =
  (typeof CardStockReceiptStatus)[keyof typeof CardStockReceiptStatus];

export const CardStockCardStatus = {
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  SOLD: 'SOLD',
} as const;

export type CardStockCardStatus =
  (typeof CardStockCardStatus)[keyof typeof CardStockCardStatus];

export const CardStockOperationType = {
  STOCK: 'STOCK',
  TRANSFER_OUT: 'TRANSFER_OUT',
  TRANSFER_IN: 'TRANSFER_IN',
  CARD_STOCK_LOAD: 'CARD_STOCK_LOAD',
  SELL: 'SELL',
  SETTLE: 'SETTLE',
  RETURN: 'RETURN',
  VOID: 'VOID',
} as const;

export type CardStockOperationType =
  (typeof CardStockOperationType)[keyof typeof CardStockOperationType];

export const CardStockReferenceType = {
  CARD_STOCK_RECEIPT: 'CARD_STOCK_RECEIPT',
  CARD_TRANSFER_REQUEST: 'CARD_TRANSFER_REQUEST',
  CARD_SALE: 'CARD_SALE',
  CARD_BRANCH_SETTLEMENT: 'CARD_BRANCH_SETTLEMENT',
  CARD_ISSUER_SETTLEMENT: 'CARD_ISSUER_SETTLEMENT',
  CARD_SETTLEMENT: 'CARD_SETTLEMENT',
  CARD_RETURN: 'CARD_RETURN',
  CARD_VOID: 'CARD_VOID',
} as const;

export type CardStockReferenceType =
  (typeof CardStockReferenceType)[keyof typeof CardStockReferenceType];

export const CardStockSettlementStatus = {
  PENDING_ISSUER_SETTLEMENT: 'PENDING_ISSUER_SETTLEMENT',
  ISSUER_SETTLED: 'ISSUER_SETTLED',
  CANCELLED: 'CANCELLED',
} as const;

export type CardStockSettlementStatus =
  (typeof CardStockSettlementStatus)[keyof typeof CardStockSettlementStatus];

export const CardTransferStatus = {
  HELD: 'HELD',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

export type CardTransferStatus =
  (typeof CardTransferStatus)[keyof typeof CardTransferStatus];
