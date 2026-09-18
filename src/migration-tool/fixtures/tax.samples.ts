import type { SourceRow } from "../migration-tool.tax";

export const SAMPLE_MST_TAX: SourceRow[] = [
  {
    nTaxID: 1,
    CODE: "TAXROFF",
    DESCRIPTION: "Tax ROUND OFF",
    APPLYAS: "%",
    VALUE: 0,
  },
  {
    nTaxID: 2,
    CODE: "HFEE",
    DESCRIPTION: "Handling Fee",
    APPLYAS: "F",
    VALUE: 21.18,
  },
  {
    nTaxID: 3,
    CODE: "gst18%",
    DESCRIPTION: "gst18%",
    APPLYAS: "%",
    VALUE: 0.18,
    SLABWISETAX: 1,
    nAccID: 4,
  },
];

export const SAMPLE_GST_INFO: SourceRow[] = [
  {
    Id: 1,
    ncodesid: 5098,
    vCode: "SON",
    CGSTNO: "",
    SGSTNO: "",
    IGSTNO: "",
    Active: 0,
  },
  {
    Id: 10,
    ncodesid: 100,
    vCode: "ACME",
    CGSTNO: "24AAECG5258K1ZF",
    SGSTNO: "24AAECG5258K1ZF",
    IGSTNO: "",
    Active: 1,
  },
  {
    Id: 11,
    ncodesid: 101,
    vCode: "BETA",
    CGSTNO: "27AAAAA0000A1Z5",
    SGSTNO: "27BBBBB0000B1Z5",
    IGSTNO: "27CCCCC0000C1Z5",
    Active: 1,
  },
];

export const SAMPLE_TCS_PER_MASTER: SourceRow[] = [
  {
    TCSAppID: 1099,
    FROMDATE: "2023-10-01",
    TODATE: "2025-03-31",
    AMTFROM: 700000.01,
    AMTTO: 99999999999,
    TCSPER: 5,
    TCSPER_WOPAN: 5,
    PARTYTYPE: "IN",
    PURPOSECODE: "S",
    bITRPRosses: 1,
  },
  {
    TCSAppID: 1100,
    FROMDATE: "2023-10-01",
    TODATE: "2025-03-31",
    AMTFROM: 700000.01,
    AMTTO: 99999999999,
    TCSPER: 5,
    PURPOSECODE: "S",
    bITRPRosses: 0,
  },
  {
    TCSAppID: 2000,
    FROMDATE: "2020-01-01",
    TODATE: "2021-01-01",
    AMTFROM: 1,
    AMTTO: 100,
    TCSPER: 1,
    PURPOSECODE: "S",
    bITRPRosses: 1,
  },
  {
    TCSAppID: 1101,
    FROMDATE: "2023-10-01",
    TODATE: "2025-03-31",
    AMTFROM: 700000.01,
    AMTTO: 99999999999,
    TCSPER: 5,
    PURPOSECODE: "M",
    bITRPRosses: 1,
  },
];
