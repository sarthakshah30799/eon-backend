import type { SourceRow } from "../migration-tool.settings";

export const SAMPLE_ADVSETTINGS: SourceRow[] = [
  {
    ID: 5505,
    DATATYPE: "B",
    DATACODE: "DIRREMSLAC",
    DATADISPLAY: "Account Code for Direct Remittance Receipt on Sale?",
    DATAVALUE: "DRDEBCTR",
    SETTINGCATEGORY: "Accounting",
    nBranchID: 0,
  },
  {
    ID: 5664,
    DATATYPE: "B",
    DATACODE: "TCSACC",
    DATADISPLAY: "TCS Account Code?",
    DATAVALUE: "TCS",
    SETTINGCATEGORY: "TCS Compliance",
    nBranchID: 1,
  },
  {
    ID: 5446,
    DATATYPE: "B",
    DATACODE: "AUTOBOD",
    DATADISPLAY: "DO AUTO BOD PROCESS@@",
    DATAVALUE: "YES",
    SETTINGCATEGORY: "GENRAL OPTIONS",
    nBranchID: 0,
  },
  {
    ID: 6542,
    DATATYPE: "V",
    DATACODE: "BULKISSUER",
    DATADISPLAY: "Bulk issuer",
    DATAVALUE: "CM",
    SETTINGCATEGORY: "Transactions",
    nBranchID: 0,
  },
  {
    ID: 7541,
    DATATYPE: "V",
    DATACODE: "BULKISSUER",
    DATADISPLAY: "Bulk issuer",
    DATAVALUE: "CC",
    SETTINGCATEGORY: "Transactions",
    nBranchID: 0,
  },
  {
    ID: 5607,
    DATATYPE: "B",
    DATACODE: "PWDALPHA",
    DATADISPLAY: "PASSWORD MUST CONTAINS ALPHABETS@@",
    DATAVALUE: "YES",
    SETTINGCATEGORY: "PASSWORD POLICY",
    nBranchID: 0,
  },
];

export const SAMPLE_PASSWORD_POLICY: SourceRow[] = [
  {
    nMinLength: 8,
    nNumAlphabets: 1,
    nNumNumeric: 1,
    nNumSpChar: 1,
    nExpDate: 30,
  },
];

export const SAMPLE_MAIL_CONFIG: SourceRow[] = [
  {
    nMailConfig: 3,
    vSmtpServer: "smtp.office365.com",
    vSmtpPort: 25,
    vSmtpUser: "bpia.nium@example.com",
    vSmtpPassword: "SOURCE_SECRET_DO_NOT_COPY",
    bEnablessl: 1,
    vFromMailid: "AUTOREPORT",
  },
];

export const SAMPLE_EOD_QUESTIONS: SourceRow[] = [
  {
    ID: 3,
    Questions: "ALL Purchase & Sales are Recorded in the System ?",
    IsActive: 1,
  },
  {
    ID: 4,
    Questions: "Bank Reconciliation is Tallied with The Bank ?",
    IsActive: 1,
  },
];
