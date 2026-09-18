import {
  CurrencyRateMarginType,
  CurrencyRateProvider,
} from "../currency-rates/currency-rates.enums";

export type SourceRow = Record<string, any>;

export const LEGACY_RATE_TABLE_CANDIDATES = {
  mstRates: ["mstRates", "mstrates", "MSTRATES"],
  marginMaster: ["MarginMaster", "marginmaster", "MARGINMASTER"],
  tickerLiveRate: ["tickerliverate", "TickerLiveRate", "TICKERLIVERATE"],
  tmpLiveRate: ["tmpliverate", "TmpLiveRate", "TMPLIVERATE"],
  stockCurrencyRate: [
    "StockCurrencyRate",
    "stockcurrencyrate",
    "STOCKCURRENCYRATE",
  ],
  preMarginMaster: ["PreMarginMaster", "premarginmaster", "PREMARGINMASTER"],
  marginMasterTt: ["MARGINMASTERTT", "marginmastertt", "MarginMasterTT"],
} as const;

export const RATE_MIGRATION_SKIPPED_TABLES = [
  {
    table: "StockCurrencyRate",
    reason:
      "Looks like stock revaluation (Rate + RevalDate), not daily FX board. Pending client confirm; not a blocker for currency_rates / product_currency_rates.",
  },
  {
    table: "PreMarginMaster",
    reason:
      "WH/NWH/Holiday margins have no matching columns on product_currency_rates. Deferred.",
  },
  {
    table: "MARGINMASTERTT",
    reason:
      "TT margin Type unclear; no issuer/product shape match. Deferred.",
  },
  {
    table: "ttdealrate",
    reason: "Empty sample; skip.",
  },
] as const;

export type UnmappedField = {
  sourceColumn: string;
  sourceValue: string | number | boolean | null;
  reason: string;
};

const toNullableString = (value: any): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

const toNullableNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
};

const toNumericString = (value: any): string | null => {
  const n = toNullableNumber(value);
  return n === null ? null : String(n);
};

const isBlankIssCode = (value: any): boolean => {
  const text = toNullableString(value);
  return text === null;
};

export type MappedMstRateRow = {
  oldId: string | null;
  rateType: string | null;
  rateFor: string | null;
  legacyBranchId: string | null;
  rateDate: Date | null;
  currencyCode: string | null;
  productCode: string | null;
  issCode: string | null;
  buy: string | null;
  buyMin: string | null;
  buyMax: string | null;
  sell: string | null;
  sellMin: string | null;
  sellMax: string | null;
  unmapped: UnmappedField[];
};

export const mapLegacyMstRateRow = (row: SourceRow): MappedMstRateRow => {
  const unmapped: UnmappedField[] = [];
  const rateFor = toNullableString(row.rateFor);
  const legacyBranchId =
    row.nBranchID != null && row.nBranchID !== ""
      ? String(row.nBranchID)
      : null;
  const issCode = toNullableString(row.IssCode ?? row.isscode);

  if (rateFor) {
    unmapped.push({
      sourceColumn: "rateFor",
      sourceValue: rateFor,
      reason:
        "Location/rateFor not stored on currency_rates; product prices go to product_currency_rates",
    });
  }
  if (legacyBranchId != null && legacyBranchId !== "0") {
    unmapped.push({
      sourceColumn: "nBranchID",
      sourceValue: legacyBranchId,
      reason: "Branch not stored on currency_rates / product_currency_rates",
    });
  } else if (legacyBranchId === "0") {
    unmapped.push({
      sourceColumn: "nBranchID",
      sourceValue: "0",
      reason: "nBranchID 0 ignored (not mapped to branch)",
    });
  }
  if (issCode) {
    unmapped.push({
      sourceColumn: "IssCode",
      sourceValue: issCode,
      reason:
        "Issuer deferred pending client; not stored on rate tables this wave",
    });
  }

  const rawDate = row.dDate ?? row.dCDate;
  let rateDate: Date | null = null;
  if (rawDate != null && rawDate !== "") {
    const parsed = new Date(rawDate);
    rateDate = Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return {
    oldId:
      row.nRateID != null && row.nRateID !== "" ? String(row.nRateID) : null,
    rateType: toNullableString(row.rateType),
    rateFor,
    legacyBranchId,
    rateDate,
    currencyCode: toNullableString(row.vCurrencyCode)?.toUpperCase() ?? null,
    productCode: toNullableString(row.vExchType)?.toUpperCase() ?? null,
    issCode,
    buy: toNumericString(row.nBuy),
    buyMin: toNumericString(row.nBuyMin),
    buyMax: toNumericString(row.nBuyMax),
    sell: toNumericString(row.nSell),
    sellMin: toNumericString(row.nSellMin),
    sellMax: toNumericString(row.nSellMax),
    unmapped,
  };
};

/**
 * Pick one mstRates row per currency for currency_rates base:
 * blank IssCode → prefer product CN → latest dDate.
 */
export const selectCurrencyBaseRateRows = (
  rows: MappedMstRateRow[],
): {
  selected: MappedMstRateRow[];
  skipped: Array<{ row: MappedMstRateRow; reason: string }>;
} => {
  const byCurrency = new Map<string, MappedMstRateRow[]>();
  const skipped: Array<{ row: MappedMstRateRow; reason: string }> = [];

  for (const row of rows) {
    if (!row.currencyCode || row.buy == null || row.sell == null) {
      skipped.push({
        row,
        reason: "Missing currencyCode or buy/sell for currency_rates base",
      });
      continue;
    }
    const list = byCurrency.get(row.currencyCode) ?? [];
    list.push(row);
    byCurrency.set(row.currencyCode, list);
  }

  const selected: MappedMstRateRow[] = [];
  for (const [currencyCode, list] of byCurrency) {
    const ranked = [...list].sort((a, b) => {
      const blankA = isBlankIssCode(a.issCode) ? 1 : 0;
      const blankB = isBlankIssCode(b.issCode) ? 1 : 0;
      if (blankB !== blankA) return blankB - blankA;
      const cnA = a.productCode === "CN" ? 1 : 0;
      const cnB = b.productCode === "CN" ? 1 : 0;
      if (cnB !== cnA) return cnB - cnA;
      const timeA = a.rateDate?.getTime() ?? 0;
      const timeB = b.rateDate?.getTime() ?? 0;
      if (timeB !== timeA) return timeB - timeA;
      return Number(b.oldId ?? 0) - Number(a.oldId ?? 0);
    });
    const winner = ranked[0];
    selected.push(winner);
    for (const row of ranked.slice(1)) {
      skipped.push({
        row,
        reason: `Not chosen as currency_rates base for ${currencyCode} (prefer blank IssCode, then CN, then latest date). Product/min-max still applied via product_currency_rates when product present.`,
      });
    }
  }

  return { selected, skipped };
};

export type AggregatedProductRateBounds = {
  currencyCode: string;
  productCode: string;
  buyMinRate: string | null;
  buyMaxRate: string | null;
  saleMinRate: string | null;
  saleMaxRate: string | null;
  sourceRowCount: number;
};

/** Collapse mstRates by product+currency into min/max bounds for product_currency_rates. */
export const aggregateMstRatesForProductCurrency = (
  rows: MappedMstRateRow[],
): AggregatedProductRateBounds[] => {
  const map = new Map<string, AggregatedProductRateBounds>();

  const minOf = (a: string | null, b: string | null): string | null => {
    if (a == null) return b;
    if (b == null) return a;
    return Number(a) <= Number(b) ? a : b;
  };
  const maxOf = (a: string | null, b: string | null): string | null => {
    if (a == null) return b;
    if (b == null) return a;
    return Number(a) >= Number(b) ? a : b;
  };

  for (const row of rows) {
    if (!row.currencyCode || !row.productCode) {
      continue;
    }
    const key = `${row.productCode}|${row.currencyCode}`;
    const existing = map.get(key) ?? {
      currencyCode: row.currencyCode,
      productCode: row.productCode,
      buyMinRate: null,
      buyMaxRate: null,
      saleMinRate: null,
      saleMaxRate: null,
      sourceRowCount: 0,
    };
    existing.buyMinRate = minOf(
      existing.buyMinRate,
      row.buyMin ?? row.buy,
    );
    existing.buyMaxRate = maxOf(
      existing.buyMaxRate,
      row.buyMax ?? row.buy,
    );
    existing.saleMinRate = minOf(
      existing.saleMinRate,
      row.sellMin ?? row.sell,
    );
    existing.saleMaxRate = maxOf(
      existing.saleMaxRate,
      row.sellMax ?? row.sell,
    );
    existing.sourceRowCount += 1;
    map.set(key, existing);
  }

  return [...map.values()];
};

export type MappedMarginMasterRow = {
  currencyCode: string | null;
  productCode: string | null;
  buyMargin: string | null;
  sellMargin: string | null;
  legacyBranchId: string | null;
  issCode: string | null;
  unmapped: UnmappedField[];
};

export const mapLegacyMarginMasterRow = (
  row: SourceRow,
): MappedMarginMasterRow => {
  const unmapped: UnmappedField[] = [];
  const legacyBranchId =
    row.nBranchID != null && row.nBranchID !== ""
      ? String(row.nBranchID)
      : null;
  const issCode = toNullableString(row.isscode ?? row.IssCode);

  if (legacyBranchId) {
    unmapped.push({
      sourceColumn: "nBranchID",
      sourceValue: legacyBranchId,
      reason: "Branch ignored on product_currency_rates this wave",
    });
  }
  if (issCode) {
    unmapped.push({
      sourceColumn: "isscode",
      sourceValue: issCode,
      reason: "Issuer ignored on product_currency_rates this wave (client confirm later)",
    });
  }
  for (const col of ["SettlementMargin", "SurrenderMargin", "Type"]) {
    if (row[col] != null && row[col] !== "") {
      unmapped.push({
        sourceColumn: col,
        sourceValue: row[col],
        reason: "Not mapped to product_currency_rates this wave",
      });
    }
  }

  return {
    currencyCode: toNullableString(row.CurrencyCode)?.toUpperCase() ?? null,
    productCode: toNullableString(row.PRODUCT ?? row.Product)?.toUpperCase() ?? null,
    buyMargin: toNumericString(row.BuyMargin),
    sellMargin: toNumericString(row.SellMargin),
    legacyBranchId,
    issCode,
    unmapped,
  };
};

export type AggregatedMargin = {
  currencyCode: string;
  productCode: string;
  buyMarginValue: string;
  saleMarginValue: string;
  buyMarginType: typeof CurrencyRateMarginType.PAISA;
  saleMarginType: typeof CurrencyRateMarginType.PAISA;
  sourceRowCount: number;
};

/** Collapse MarginMaster by product+currency: lowest buy margin, highest sell margin. */
export const aggregateMarginMasterForProductCurrency = (
  rows: MappedMarginMasterRow[],
): AggregatedMargin[] => {
  const map = new Map<
    string,
    { currencyCode: string; productCode: string; buys: number[]; sells: number[] }
  >();

  for (const row of rows) {
    if (
      !row.currencyCode ||
      !row.productCode ||
      row.buyMargin == null ||
      row.sellMargin == null
    ) {
      continue;
    }
    const key = `${row.productCode}|${row.currencyCode}`;
    const existing = map.get(key) ?? {
      currencyCode: row.currencyCode,
      productCode: row.productCode,
      buys: [],
      sells: [],
    };
    existing.buys.push(Number(row.buyMargin));
    existing.sells.push(Number(row.sellMargin));
    map.set(key, existing);
  }

  return [...map.values()].map((entry) => ({
    currencyCode: entry.currencyCode,
    productCode: entry.productCode,
    buyMarginValue: String(Math.min(...entry.buys)),
    saleMarginValue: String(Math.max(...entry.sells)),
    buyMarginType: CurrencyRateMarginType.PAISA,
    saleMarginType: CurrencyRateMarginType.PAISA,
    sourceRowCount: entry.buys.length,
  }));
};

export type MappedTickerRate = {
  currencyCode: string | null;
  baseBuyRate: string | null;
  baseSaleRate: string | null;
  provider: typeof CurrencyRateProvider.TICKER;
  sourceTable: string;
  sourceKey: string;
  unmapped: UnmappedField[];
  skipReason: string | null;
};

/** Parse tickerliverate Symbol like GBPINRCOMP → GBP. */
export const parseTickerSymbolCurrencyCode = (
  symbol: any,
): string | null => {
  const text = toNullableString(symbol)?.toUpperCase() ?? null;
  if (!text) return null;
  const match = text.match(/^([A-Z]{3})INR/);
  return match?.[1] ?? null;
};

export const mapLegacyTickerLiveRate = (row: SourceRow): MappedTickerRate => {
  const unmapped: UnmappedField[] = [];
  const symbol = toNullableString(row.Symbol);
  const currencyCode = parseTickerSymbolCurrencyCode(symbol);
  if (symbol && !currencyCode) {
    unmapped.push({
      sourceColumn: "Symbol",
      sourceValue: symbol,
      reason: "Could not parse currency code from ticker Symbol",
    });
  }
  return {
    currencyCode,
    baseBuyRate: toNumericString(row.BestBuyPrice),
    baseSaleRate: toNumericString(row.BestSellPrice),
    provider: CurrencyRateProvider.TICKER,
    sourceTable: "tickerliverate",
    sourceKey: `${symbol ?? "?"}:${row.DateTime ?? row.nMsgTimeStamp ?? ""}`,
    unmapped,
    skipReason: !currencyCode
      ? "Unparseable Symbol for currency code"
      : toNumericString(row.BestBuyPrice) == null ||
          toNumericString(row.BestSellPrice) == null
        ? "Missing BestBuyPrice/BestSellPrice"
        : null,
  };
};

export const mapLegacyTmpLiveRate = (row: SourceRow): MappedTickerRate => {
  const currencyCode =
    toNullableString(row.CurrencyCode)?.toUpperCase() ?? null;
  const ask = toNumericString(row.InrAsk);
  const bid = toNumericString(row.InrBid);
  // InrBid ≈ buy side from bank, InrAsk ≈ sell — map bid→buy, ask→sale for board.
  return {
    currencyCode,
    baseBuyRate: bid,
    baseSaleRate: ask,
    provider: CurrencyRateProvider.TICKER,
    sourceTable: "tmpliverate",
    sourceKey: String(row.LiveRateID ?? `${currencyCode}`),
    unmapped: [],
    skipReason: !currencyCode
      ? "Missing CurrencyCode"
      : bid == null || ask == null
        ? "Missing InrBid/InrAsk"
        : null,
  };
};

export { CurrencyRateMarginType, CurrencyRateProvider };
