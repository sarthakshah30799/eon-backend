export const ProductSettlementStatus = {
  PENDING_BRANCH_SETTLEMENT: "PENDING_BRANCH_SETTLEMENT",
  PENDING_HO_ACCEPTANCE: "PENDING_HO_ACCEPTANCE",
  PENDING_ISSUER_SETTLEMENT: "PENDING_ISSUER_SETTLEMENT",
  ISSUER_SETTLED: "ISSUER_SETTLED",
  CANCELLED: "CANCELLED",
} as const;

export type ProductSettlementStatus =
  (typeof ProductSettlementStatus)[keyof typeof ProductSettlementStatus];

export const ProductSettlementMode = {
  AUTO: "AUTO",
  MANUAL: "MANUAL",
} as const;

export type ProductSettlementMode =
  (typeof ProductSettlementMode)[keyof typeof ProductSettlementMode];

export const ProductSettlementSaleKind = {
  FRESH: "FRESH",
  RELOAD: "RELOAD",
} as const;

export type ProductSettlementSaleKind =
  (typeof ProductSettlementSaleKind)[keyof typeof ProductSettlementSaleKind];

export const ProductSettlementType = {
  CARD: "CARD",
  TT: "TT",
} as const;

export type ProductSettlementType =
  (typeof ProductSettlementType)[keyof typeof ProductSettlementType];

export const ProductSettlementDocumentKind = {
  BRANCH_HO: "BRANCH_HO",
  HO_ISSUER: "HO_ISSUER",
} as const;

export type ProductSettlementDocumentKind =
  (typeof ProductSettlementDocumentKind)[keyof typeof ProductSettlementDocumentKind];

export const ProductSettlementDocumentStatus = {
  PENDING_HO_ACCEPTANCE: "PENDING_HO_ACCEPTANCE",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  ISSUER_SETTLED: "ISSUER_SETTLED",
} as const;

export type ProductSettlementDocumentStatus =
  (typeof ProductSettlementDocumentStatus)[keyof typeof ProductSettlementDocumentStatus];
