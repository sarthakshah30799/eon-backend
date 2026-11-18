export enum AdvanceAdjustmentStatus {
  DRAFT = "DRAFT",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum AdvanceAdjustmentPrintCopyType {
  CUSTOMER_COPY = "CUSTOMER_COPY",
  DUPLICATE_COPY = "DUPLICATE_COPY",
}

export const AdvanceAdjustmentLogAction = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  PRINT: "PRINT",
} as const;

export type AdvanceAdjustmentLogAction =
  (typeof AdvanceAdjustmentLogAction)[keyof typeof AdvanceAdjustmentLogAction];

export const ADVANCE_ADJUSTMENT_NUMBER_SERIES = "ADVANCE_ADJUSTMENT";
