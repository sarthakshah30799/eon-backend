export const DayEndEventStatus = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  PROCESSED: "PROCESSED",
  FAILED: "FAILED",
} as const;

export type DayEndEventStatus =
  (typeof DayEndEventStatus)[keyof typeof DayEndEventStatus];

export const DayEndEventType = {
  CLEAR_TEMPORARY_CREDIT: "CLEAR_TEMPORARY_CREDIT",
} as const;

export type DayEndEventType =
  (typeof DayEndEventType)[keyof typeof DayEndEventType];

/** Post-EOD jobs enqueued when Day End completes. Add future report types here. */
export const DAY_END_POST_PROCESS_EVENT_TYPES: DayEndEventType[] = [
  DayEndEventType.CLEAR_TEMPORARY_CREDIT,
];
