export const FlmReportLayout = {
  BRANCH_WISE: "branch_wise",
  CONSOLIDATE: "consolidate",
} as const;

export type FlmReportLayout =
  (typeof FlmReportLayout)[keyof typeof FlmReportLayout];

export const DEFAULT_FLM_REPORT_LAYOUT = FlmReportLayout.BRANCH_WISE;

export const resolveFlmReportLayout = (layout?: string): FlmReportLayout =>
  layout === FlmReportLayout.CONSOLIDATE
    ? FlmReportLayout.CONSOLIDATE
    : FlmReportLayout.BRANCH_WISE;
