import type { SourceRow } from "../migration-tool.party";

/** Minimal high-confidence mstCodes samples for mapper tests. */
export const SAMPLE_MST_CODES_TC: SourceRow = {
  nCodesID: 9001,
  vType: "TC",
  vCode: "THOM",
  vName: "Thomas Cook Card Issuer",
  vAddress1: "Issuer Street",
  vCity: "Mumbai",
  vPinCode: "400001",
  bActive: 1,
  bIsDeleted: 0,
  bIsverified: 0,
  nBranchID: 5,
  vBranchCode: "HO001",
  vGrpcode: "SRTC",
  vEntityType: "0",
  vBusinessNature: "OT",
  vTDSGroup: "A",
  vDefaultAgent: "0",
  nMrktExecutive: 0,
};

export const SAMPLE_MST_CODES_CC: SourceRow = {
  nCodesID: 1001,
  vType: "CC",
  vCode: "22FTRI",
  vName: "Sample Corporate",
  vAddress1: "",
  vCity: "",
  vPinCode: "",
  bActive: 1,
  bIND: 0,
  bPurchaseParty: 1,
  bSaleParty: 1,
  bPrintAddress: 1,
  bEEFCClient: 0,
  bIGSTOnly: 0,
  bServiceTax: 1,
  bTDSDED: 1,
  nTDSPER: 10,
  vPan: "ABCDE1234F",
  vKYCRiskCategory: "Low",
  vEntityType: "PB",
  vBusinessNature: "OT",
  vGrpcode: "SRCC",
  vTDSGroup: "A",
  vDefaultAgent: "AARSFO",
  nMrktExecutive: 8524,
  AccHolderName: "Sample Corp",
  BankName: "HDFC",
  AccNumber: "123456",
  IFSCCode: "HDFC0001",
};

export const SAMPLE_MST_CODES_TA: SourceRow = {
  nCodesID: 5101,
  vType: "TA",
  vCode: "AARSFO",
  vName: "AARSHEYA FOREX PRIVATE LIMITED",
  vAddress1: "Agent Road",
  vCity: "Pune",
  vPinCode: "411001",
  bActive: 1,
  vGrpcode: "SRAG",
};

export const SAMPLE_MST_CODES_ME: SourceRow = {
  nCodesID: 8524,
  vType: "ME",
  vCode: "MURH",
  vName: "ROHIT SAINI",
  vAddress1: "ME Lane",
  vCity: "Delhi",
  vPinCode: "110001",
  bActive: 1,
  bIsverified: 1,
};

export const SAMPLE_MST_CODES_GS_SKIP: SourceRow = {
  nCodesID: 11,
  vType: "GS",
  vCode: "MH",
  vName: "Maharashtra",
  bActive: 1,
};

export const SAMPLE_MST_CODES_MR_DEFERRED: SourceRow = {
  nCodesID: 22,
  vType: "MR",
  vCode: "SOMEONE",
  vName: "Person Name",
  bActive: 1,
};

export const SAMPLE_PRODUCT_ISSUER_LINK: SourceRow = {
  PRODUCTCODE: "CC",
  nIssuerID: 9001,
  ISACTIVE: 1,
};
