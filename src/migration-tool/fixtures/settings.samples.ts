import type { SourceRow } from "../migration-tool.settings";

/** Representative advsettings rows (including duplicate DATACODE / branch=1). */
export const SAMPLE_ADV_SETTINGS: SourceRow[] = [
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
    ID: 5814,
    DATATYPE: "N",
    DATACODE: "PWDLEN",
    DATADISPLAY: "MIN. CHARACTERS OF PASSWORD",
    DATAVALUE: "7",
    SETTINGCATEGORY: "PASSWORD POLICY",
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
  {
    ID: 6542,
    DATATYPE: "V",
    DATACODE: "BULKISSUER",
    DATADISPLAY: "NIUMMCC",
    DATAVALUE: "CM",
    SETTINGCATEGORY: "GENERAL OPTIONS",
    nBranchID: 0,
  },
  {
    ID: 6543,
    DATATYPE: "V",
    DATACODE: "BULKISSUER",
    DATADISPLAY: "NIUMSCC",
    DATAVALUE: "CC",
    SETTINGCATEGORY: "GENERAL OPTIONS",
    nBranchID: 0,
  },
  {
    ID: 6544,
    DATATYPE: "V",
    DATACODE: "BULKISSUER",
    DATADISPLAY: "NIUMMCC",
    DATAVALUE: "EM",
    SETTINGCATEGORY: "GENERAL OPTIONS",
    nBranchID: 0,
  },
  {
    ID: 7541,
    DATATYPE: "V",
    DATACODE: "BULKISSUER",
    DATADISPLAY: "NIUMSCC",
    DATAVALUE: "EM",
    SETTINGCATEGORY: "GENERAL OPTIONS",
    nBranchID: 0,
  },
  {
    ID: 5394,
    DATATYPE: "B",
    DATACODE: "-1DIRREMIT",
    DATADISPLAY: "ACTIVATE DIRECT REMITTANCE OF FUND FEATURE@@",
    DATAVALUE: "YES",
    SETTINGCATEGORY: "GENERAL OPTIONS",
    nBranchID: 0,
  },
  {
    ID: 5563,
    DATATYPE: "B",
    DATACODE: "LockWDV",
    DATADISPLAY:
      "Percentage for max Aggeregate Depreciation on Basic Value",
    DATAVALUE: "100",
    SETTINGCATEGORY: "General Options",
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

/** Fake SMTP secrets — mapper must never return these as password. */
export const SAMPLE_MAIL_CONFIG: SourceRow[] = [
  {
    nMailConfig: 3,
    vSmtpServer: "smtp.office365.com",
    vSmtpPort: 25,
    vSmtpUser: "bpia.nium@Instarem.co.in",
    vSmtpPassword: "SOURCE_SECRET_DO_NOT_COPY",
    bEnablessl: 1,
    nCreatedBy: 2039,
    dCreatedDate: "2022-12-05 12:53:04.867",
    vFromMailid: "AUTOREPORT",
  },
  {
    nMailConfig: 4,
    vSmtpServer: "smtp.gmail.com",
    vSmtpPort: 587,
    vSmtpUser: "maraekatinfotechltd@gmail.com",
    vSmtpPassword: "SOURCE_SECRET_DO_NOT_COPY",
    bEnablessl: 0,
    nCreatedBy: 13,
    dCreatedDate: null,
    vFromMailid: "AUTOREPORT2",
  },
];

export const SAMPLE_EOD_QUESTION: SourceRow[] = [
  {
    ID: 3,
    Questions: "ALL Purchase & Sales are Recorded in the System ?",
    IsActive: 1,
    CreatedOn: "2024-01-17 15:35:12.827",
  },
  {
    ID: 4,
    Questions: "Bank Reconciliation is Tallied with The Bank ?",
    IsActive: 1,
    CreatedOn: "2024-01-17 15:35:12.827",
  },
  {
    ID: 6,
    Questions:
      "Physical FCY & INR Balance is Tallied & Recorded in the Branch ?",
    IsActive: 0,
    CreatedOn: "2024-01-17 15:35:12.827",
  },
];
