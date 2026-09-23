export const DealCoverStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;

export type DealCoverStatus =
  (typeof DealCoverStatus)[keyof typeof DealCoverStatus];
