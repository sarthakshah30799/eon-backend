export const TtSettlementMode = {
  AUTO: "AUTO",
  MANUAL: "MANUAL",
} as const;

export type TtSettlementMode =
  (typeof TtSettlementMode)[keyof typeof TtSettlementMode];

export const TtSettlementStatus = {
  UNSETTLED: "UNSETTLED",
  PENDING_HO_ACCEPTANCE: "PENDING_HO_ACCEPTANCE",
  BRANCH_HO_ACCEPTED: "BRANCH_HO_ACCEPTED",
  HO_ISSUER_PENDING: "HO_ISSUER_PENDING",
  SETTLED: "SETTLED",
  CANCELLED: "CANCELLED",
} as const;

export type TtSettlementStatus =
  (typeof TtSettlementStatus)[keyof typeof TtSettlementStatus];

export const TtSettlementDocumentKind = {
  BRANCH_HO: "BRANCH_HO",
  HO_ISSUER: "HO_ISSUER",
} as const;

export type TtSettlementDocumentKind =
  (typeof TtSettlementDocumentKind)[keyof typeof TtSettlementDocumentKind];

export const TtSettlementDocumentStatus = {
  DRAFT: "DRAFT",
  PENDING_HO_ACCEPTANCE: "PENDING_HO_ACCEPTANCE",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  POSTED: "POSTED",
} as const;

export type TtSettlementDocumentStatus =
  (typeof TtSettlementDocumentStatus)[keyof typeof TtSettlementDocumentStatus];
