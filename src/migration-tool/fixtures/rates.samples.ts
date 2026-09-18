import type { SourceRow } from "../migration-tool.rates";

export const SAMPLE_MST_RATES: SourceRow[] = [
  {
    nRateID: 45241,
    rateType: "I",
    rateFor: "AIRPORT LOCATION",
    nBranchID: 0,
    dDate: "2026-08-22 18:30:00.090",
    vCurrencyCode: "AED",
    vExchType: "CN",
    nBuy: 25.9,
    nBuyMin: 25.9,
    nBuyMax: 25.9,
    nSell: 26.1075,
    nSellMin: 26.1075,
    nSellMax: 26.1075,
    IssCode: "",
  },
  {
    nRateID: 524,
    rateType: "C",
    rateFor: "AIRPORT LOCATION",
    nBranchID: 0,
    dDate: "2026-08-22 18:33:00.153",
    vCurrencyCode: "AED",
    vExchType: "CC",
    nBuy: 24.7475,
    nBuyMin: 24.7475,
    nBuyMax: 24.7475,
    nSell: 27.360375,
    nSellMin: 27.360375,
    nSellMax: 27.360375,
    IssCode: "NIUMSCC",
  },
  {
    nRateID: 525,
    rateType: "C",
    rateFor: "AIRPORT LOCATION",
    nBranchID: 0,
    dDate: "2026-08-22 18:33:00.153",
    vCurrencyCode: "THB",
    vExchType: "CM",
    nBuy: 2.78122,
    nBuyMin: 2.78122,
    nBuyMax: 2.78122,
    nSell: 3.07461,
    nSellMin: 3.07461,
    nSellMax: 3.07461,
    IssCode: "NIUMMCC",
  },
];

export const SAMPLE_MARGIN_MASTER: SourceRow[] = [
  {
    CurrencyCode: "AED",
    BuyMargin: 5.0,
    SellMargin: 5.0,
    SettlementMargin: 5.0,
    SurrenderMargin: 5.0,
    Type: 0,
    nBranchID: 27,
    isscode: "NIUMSCC",
    PRODUCT: "CC",
  },
  {
    CurrencyCode: "AED",
    BuyMargin: 0.2,
    SellMargin: 0.2,
    SettlementMargin: 0.2,
    SurrenderMargin: 0.2,
    Type: 0,
    nBranchID: 29,
    isscode: "ICICIMCC",
    PRODUCT: "CM",
  },
  {
    CurrencyCode: "AED",
    BuyMargin: 1.0,
    SellMargin: 8.0,
    SettlementMargin: 0,
    SurrenderMargin: 0,
    Type: 0,
    nBranchID: 28,
    isscode: "NIUMSCC",
    PRODUCT: "CC",
  },
];

export const SAMPLE_TICKER_LIVE: SourceRow[] = [
  {
    Symbol: "GBPINRCOMP",
    DateTime: "2026-08-18 15:39:55.000",
    BestBuyPrice: 129.44,
    BestSellPrice: 129.4575,
  },
  {
    Symbol: "UNKNOWNPAIR",
    BestBuyPrice: 1,
    BestSellPrice: 2,
  },
];

export const SAMPLE_TMP_LIVE: SourceRow[] = [
  {
    LiveRateID: 8,
    CurrencyCode: "AED",
    InrAsk: 22.8575,
    InrBid: 22.865,
    Dated: "2024-10-04 00:00:00.000",
  },
];
