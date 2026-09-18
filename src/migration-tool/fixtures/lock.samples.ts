import type { SourceRow } from "../migration-tool.lock";

export const SAMPLE_MONTHLOCK: SourceRow[] = [
  {
    nMonthLockID: 399,
    fromdate: "2025-03-31 00:00:00.000",
    todate: "2025-03-31 00:00:00.000",
    vs_coname: "AHMD",
    OPENACCOUNT: 0,
    OPENTRADING: 1,
    CASHTXN: 0,
    bIsDeleted: 1,
  },
  {
    nMonthLockID: 400,
    fromdate: "2025-03-31 00:00:00.000",
    todate: "2025-04-01 00:00:00.000",
    vs_coname: "AHMD",
    OPENACCOUNT: 1,
    OPENTRADING: 0,
    CASHTXN: 0,
    bIsDeleted: 1,
  },
];

export const SAMPLE_MLOCK_BRN_USER_LINK: SourceRow[] = [
  {
    nMLockBrnUserID: 2509,
    nBrnID: 1,
    vBrnCode: "AHMD",
    nUID: 2038,
    vUName: "ABHIJIT MISHRA",
    isActive: 0,
    bIsDeleted: 0,
  },
  {
    nMLockBrnUserID: 2545,
    nBrnID: 1,
    vBrnCode: "AHMD",
    nUID: 2039,
    vUName: "ADMINISTRATOR",
    isActive: 1,
    bIsDeleted: 0,
  },
];
