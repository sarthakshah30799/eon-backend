export const CardStockReceiptStatus = {
  POSTED: "POSTED",
} as const;

export type CardStockReceiptStatus =
  (typeof CardStockReceiptStatus)[keyof typeof CardStockReceiptStatus];

export const CardStockCardStatus = {
  AVAILABLE: "AVAILABLE",
  RESERVED: "RESERVED",
  SOLD: "SOLD",
} as const;

export type CardStockCardStatus =
  (typeof CardStockCardStatus)[keyof typeof CardStockCardStatus];

export const CardStockOperationType = {
  STOCK: "STOCK",
  TRANSFER_OUT: "TRANSFER_OUT",
  TRANSFER_IN: "TRANSFER_IN",
  CARD_STOCK_LOAD: "CARD_STOCK_LOAD",
  SELL: "SELL",
  SETTLE: "SETTLE",
  RETURN: "RETURN",
  VOID: "VOID",
} as const;

export type CardStockOperationType =
  (typeof CardStockOperationType)[keyof typeof CardStockOperationType];

export const CardStockReferenceType = {
  CARD_STOCK_RECEIPT: "CARD_STOCK_RECEIPT",
  CARD_TRANSFER_REQUEST: "CARD_TRANSFER_REQUEST",
  CARD_SALE: "CARD_SALE",
  CARD_BRANCH_SETTLEMENT: "CARD_BRANCH_SETTLEMENT",
  CARD_ISSUER_SETTLEMENT: "CARD_ISSUER_SETTLEMENT",
  CARD_SETTLEMENT: "CARD_SETTLEMENT",
  CARD_RETURN: "CARD_RETURN",
  CARD_VOID: "CARD_VOID",
} as const;

export type CardStockReferenceType =
  (typeof CardStockReferenceType)[keyof typeof CardStockReferenceType];

export const CardStockSettlementStatus = {
  PENDING_BRANCH_SETTLEMENT: "PENDING_BRANCH_SETTLEMENT",
  PENDING_HO_ACCEPTANCE: "PENDING_HO_ACCEPTANCE",
  PENDING_ISSUER_SETTLEMENT: "PENDING_ISSUER_SETTLEMENT",
  ISSUER_SETTLED: "ISSUER_SETTLED",
  CANCELLED: "CANCELLED",
} as const;

export type CardStockSettlementStatus =
  (typeof CardStockSettlementStatus)[keyof typeof CardStockSettlementStatus];

export const CardStockSettlementMode = {
  AUTO: "AUTO",
  MANUAL: "MANUAL",
} as const;

export type CardStockSettlementMode =
  (typeof CardStockSettlementMode)[keyof typeof CardStockSettlementMode];

export const CardStockSettlementSaleKind = {
  FRESH: "FRESH",
  RELOAD: "RELOAD",
} as const;

export type CardStockSettlementSaleKind =
  (typeof CardStockSettlementSaleKind)[keyof typeof CardStockSettlementSaleKind];

export const CardStockSettlementDocumentKind = {
  BRANCH_HO: "BRANCH_HO",
  HO_ISSUER: "HO_ISSUER",
} as const;

export type CardStockSettlementDocumentKind =
  (typeof CardStockSettlementDocumentKind)[keyof typeof CardStockSettlementDocumentKind];

export const CardStockSettlementDocumentStatus = {
  PENDING_HO_ACCEPTANCE: "PENDING_HO_ACCEPTANCE",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  ISSUER_SETTLED: "ISSUER_SETTLED",
} as const;

export type CardStockSettlementDocumentStatus =
  (typeof CardStockSettlementDocumentStatus)[keyof typeof CardStockSettlementDocumentStatus];

export const CardTransferStatus = {
  HELD: "HELD",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;

export type CardTransferStatus =
  (typeof CardTransferStatus)[keyof typeof CardTransferStatus];
