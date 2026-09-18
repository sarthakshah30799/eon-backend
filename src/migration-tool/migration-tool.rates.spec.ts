import {
  aggregateMarginMasterForProductCurrency,
  aggregateMstRatesForProductCurrency,
  mapLegacyMarginMasterRow,
  mapLegacyMstRateRow,
  mapLegacyTickerLiveRate,
  mapLegacyTmpLiveRate,
  parseTickerSymbolCurrencyCode,
  selectCurrencyBaseRateRows,
} from "./migration-tool.rates";
import {
  SAMPLE_MARGIN_MASTER,
  SAMPLE_MST_RATES,
  SAMPLE_TICKER_LIVE,
  SAMPLE_TMP_LIVE,
} from "./fixtures/rates.samples";

describe("migration-tool.rates", () => {
  it("maps mstRates and logs rateFor/branch/issuer as unmapped", () => {
    const mapped = mapLegacyMstRateRow(SAMPLE_MST_RATES[0]);
    expect(mapped.currencyCode).toBe("AED");
    expect(mapped.productCode).toBe("CN");
    expect(mapped.buy).toBe("25.9");
    expect(mapped.unmapped.some((f) => f.sourceColumn === "rateFor")).toBe(
      true,
    );
    expect(mapped.unmapped.some((f) => f.sourceColumn === "nBranchID")).toBe(
      true,
    );
  });

  it("selects blank IssCode + CN as currency_rates base for AED", () => {
    const mapped = SAMPLE_MST_RATES.map(mapLegacyMstRateRow);
    const { selected, skipped } = selectCurrencyBaseRateRows(mapped);
    const aed = selected.find((row) => row.currencyCode === "AED");
    expect(aed?.productCode).toBe("CN");
    expect(aed?.issCode).toBeNull();
    expect(
      skipped.some(
        (item) =>
          item.row.productCode === "CC" && item.row.currencyCode === "AED",
      ),
    ).toBe(true);
  });

  it("aggregates mstRates min/max per product+currency", () => {
    const bounds = aggregateMstRatesForProductCurrency(
      SAMPLE_MST_RATES.map(mapLegacyMstRateRow),
    );
    const aedCn = bounds.find(
      (row) => row.productCode === "CN" && row.currencyCode === "AED",
    );
    const aedCc = bounds.find(
      (row) => row.productCode === "CC" && row.currencyCode === "AED",
    );
    expect(aedCn?.buyMinRate).toBe("25.9");
    expect(aedCc?.saleMaxRate).toBe("27.360375");
  });

  it("collapses MarginMaster to lowest buy and highest sell margin", () => {
    const aggregated = aggregateMarginMasterForProductCurrency(
      SAMPLE_MARGIN_MASTER.map(mapLegacyMarginMasterRow),
    );
    const aedCc = aggregated.find(
      (row) => row.productCode === "CC" && row.currencyCode === "AED",
    );
    expect(aedCc).toMatchObject({
      buyMarginValue: "1",
      saleMarginValue: "8",
      buyMarginType: "PAISA",
      saleMarginType: "PAISA",
      sourceRowCount: 2,
    });
  });

  it("parses ticker Symbol and maps tmp live rates", () => {
    expect(parseTickerSymbolCurrencyCode("GBPINRCOMP")).toBe("GBP");
    const ticker = mapLegacyTickerLiveRate(SAMPLE_TICKER_LIVE[0]);
    expect(ticker.currencyCode).toBe("GBP");
    expect(ticker.baseBuyRate).toBe("129.44");
    expect(mapLegacyTickerLiveRate(SAMPLE_TICKER_LIVE[1]).skipReason).toBeTruthy();

    const tmp = mapLegacyTmpLiveRate(SAMPLE_TMP_LIVE[0]);
    expect(tmp).toMatchObject({
      currencyCode: "AED",
      baseBuyRate: "22.865",
      baseSaleRate: "22.8575",
      provider: "TICKER",
      skipReason: null,
    });
  });
});
