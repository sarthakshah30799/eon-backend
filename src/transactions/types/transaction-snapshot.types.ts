export interface TransactionReferenceSnapshot {
  id: string;
  code?: string | null;
  name?: string | null;
  label?: string | null;
  [key: string]: unknown;
}

export type TransactionReferenceSnapshotValue =
  | TransactionReferenceSnapshot
  | null;

export interface TransactionItemSnapshot extends TransactionReferenceSnapshot {}

export interface TransactionPricingRuleSnapshot {
  id?: string;
  source?: string | null;
  buy?: Record<string, unknown> | null;
  sale?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export type TransactionPricingRuleSnapshotValue =
  | TransactionPricingRuleSnapshot
  | null;
