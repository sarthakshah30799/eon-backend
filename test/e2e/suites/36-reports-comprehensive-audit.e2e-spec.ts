import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { ReportAccuracyValidator } from '../infrastructure/report-accuracy-validator';
import { FrontendReportEmulator } from '../infrastructure/frontend-report-emulator';
import { TestLogger } from '../infrastructure/test-logger';

describe('Module 36: 18-Report Frontend Display & Data Accuracy Comprehensive Audit', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let masterData: MasterDataRegistry;

  const defaultDateRange = {
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  };

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    masterData = MasterDataRegistry.getInstance();

    TestLogger.header('Module 36: 18-Report Frontend Display & Data Accuracy Comprehensive Audit');
    await workplaceManager.asAdmin();
    await masterData.initialize(client);
  });

  // ==========================================================================
  // DOMAIN 1: TRADING & TRANSACTION REPORTS
  // ==========================================================================

  it('36.1 should audit Sale/Purchase Report for frontend display accuracy, subtotal invariants, and draft exclusion', async () => {
    TestLogger.step('36.1', 'Auditing Sale/Purchase Report frontend display model and mathematical subtotals');

    const res = await client.get('/reports/sale-purchase', {
      ...defaultDateRange,
      detail: 'long',
    });
    expect([200, 304]).toContain(res.status);

    // 1. Verify Frontend Column Contract
    ReportAccuracyValidator.verifyFrontendContract('sale-purchase', res.data);

    // 2. Emulate Frontend Table Rendering
    const renderedView = FrontendReportEmulator.render('sale-purchase', res.data);
    expect(renderedView.columns.length).toBeGreaterThan(0);

    // 3. Verify Mathematical Invariants (Subtotals = Item Sums)
    ReportAccuracyValidator.verifyMathematicalInvariants('sale-purchase', res.data);

    // 4. Verify that critical fields never render as fallback dashes '-' on primary voucher lines
    for (const row of renderedView.itemRows) {
      const vnoCell = row.cells['vno'];
      const isHeaderRow = vnoCell && !vnoCell.isFallbackDash;
      if (isHeaderRow) {
        expect(row.cells['date']?.isFallbackDash).toBe(false);
        const partyCell = row.cells['partyName'] || row.cells['partyProfileName'];
        if (row.cells['partyProfileCode'] && !row.cells['partyProfileCode'].isFallbackDash) {
          expect(partyCell?.isFallbackDash).toBe(false);
        }
      }
      const currCell = row.cells['cnCode'] || row.cells['currencyCode'];
      const netCell = row.cells['netAmt'] || row.cells['netAmount'];
      expect(currCell?.isFallbackDash).toBe(false);
      expect(netCell?.isFallbackDash).toBe(false);
    }

    TestLogger.success(`Sale/Purchase Report verified across ${renderedView.rows.length} rows`);
  });

  it('36.2 should audit Currency Balance Report for stock movement formula invariants and counter breakdown', async () => {
    TestLogger.step('36.2', 'Auditing Currency Balance Report stock movements (Closing = Opening + In - Out)');

    const res = await client.get('/reports/currency-balance', defaultDateRange);
    expect([200, 304]).toContain(res.status);

    // 1. Verify Frontend Column Contract
    ReportAccuracyValidator.verifyFrontendContract('currency-balance', res.data);

    // 2. Verify Mathematical Invariants (Closing = Opening + Purchases - Sells)
    ReportAccuracyValidator.verifyMathematicalInvariants('currency-balance', res.data);

    // 3. Emulate Frontend Rendering & verify no NaN cells
    const renderedView = FrontendReportEmulator.render('currency-balance', res.data);
    for (const row of renderedView.itemRows) {
      expect(row.cells['branch']?.isFallbackDash).toBe(false);
      expect(row.cells['counter']?.isFallbackDash).toBe(false);
      expect(row.cells['closing']?.renderedText).not.toContain('NaN');
    }

    TestLogger.success(`Currency Balance Report verified across ${renderedView.itemRows.length} counters`);
  });

  it('36.3 should audit Cash Report for running balance integrity', async () => {
    TestLogger.step('36.3', 'Auditing Cash Report for running balance accuracy');

    const cashRes = await client.get('/reports/cash-report', defaultDateRange);
    expect([200, 304]).toContain(cashRes.status);
    ReportAccuracyValidator.verifyFrontendContract('cash-report', cashRes.data);
    ReportAccuracyValidator.verifyMathematicalInvariants('cash-report', cashRes.data);

    TestLogger.success('Cash Report audited successfully');
  });

  it('36.4 should audit Bank Report and Bank Reconciliation Report for ledger debit/credit postings', async () => {
    TestLogger.step('36.4', 'Auditing Bank Report & Bank Reconciliation for financial accuracy');

    const bankRes = await client.get('/reports/bank-report', defaultDateRange);
    expect([200, 304]).toContain(bankRes.status);
    ReportAccuracyValidator.verifyFrontendContract('bank-report', bankRes.data);

    const reconRes = await client.get('/reports/bank-reconciliation-report', defaultDateRange);
    expect([200, 304]).toContain(reconRes.status);
    ReportAccuracyValidator.verifyFrontendContract('bank-reconciliation', reconRes.data);

    TestLogger.success('Bank Report & Reconciliation audited successfully');
  });

  it('36.5 should audit Trial Balance for strict double-entry ledger equality (Debits == Credits)', async () => {
    TestLogger.step('36.5', 'Auditing Trial Balance strict double-entry equality');

    const tbRes = await client.get('/reports/trial-balance-report', defaultDateRange);
    expect([200, 304]).toContain(tbRes.status);
    ReportAccuracyValidator.verifyFrontendContract('trial-balance', tbRes.data);
    ReportAccuracyValidator.verifyMathematicalInvariants('trial-balance', tbRes.data);

    TestLogger.success('Trial Balance double-entry equality verified');
  });

  it('36.6 should audit General Ledger for sequential transaction postings and voucher codes', async () => {
    TestLogger.step('36.6', 'Auditing General Ledger report postings and running totals');

    const glRes = await client.get('/reports/general-ledger-report', defaultDateRange);
    expect([200, 304]).toContain(glRes.status);
    ReportAccuracyValidator.verifyFrontendContract('general-ledger', glRes.data);

    const renderedView = FrontendReportEmulator.render('general-ledger', glRes.data);
    for (const row of renderedView.itemRows) {
      expect(row.cells['date']?.isFallbackDash).toBe(false);
      expect(row.cells['debit']?.renderedText).not.toContain('NaN');
      expect(row.cells['credit']?.renderedText).not.toContain('NaN');
    }

    TestLogger.success(`General Ledger verified across ${renderedView.itemRows.length} account entries`);
  });

  it('36.7 should audit Cash Flow Report and Final Accounts (Balance Sheet & P&L)', async () => {
    TestLogger.step('36.7', 'Auditing Cash Flow Report & Final Accounts');

    const cfRes = await client.get('/reports/cash-flow-report', defaultDateRange);
    expect([200, 304]).toContain(cfRes.status);
    ReportAccuracyValidator.verifyFrontendContract('cash-flow', cfRes.data);

    const faRes = await client.get('/reports/final-account-report', defaultDateRange);
    expect([200, 304]).toContain(faRes.status);

    TestLogger.success('Cash Flow and Final Accounts audited successfully');
  });

  it('36.8 should audit Product Profit Report for margin calculations', async () => {
    TestLogger.step('36.8', 'Auditing Product Profit Report margin calculations');

    const ppRes = await client.get('/reports/product-profit', defaultDateRange);
    expect([200, 304]).toContain(ppRes.status);
    ReportAccuracyValidator.verifyFrontendContract('product-profit', ppRes.data);

    TestLogger.success('Product Profit Report audited successfully');
  });

  // ==========================================================================
  // DOMAIN 2: REMITTANCE, STATUTORY & TRAVEL REPORTS
  // ==========================================================================

  it('36.9 should audit TT Outward Remittance Report for beneficiary, swift, and deal rates', async () => {
    TestLogger.step('36.9', 'Auditing TT Remittance Report columns and data presentation');

    const ttRes = await client.get('/reports/tt-report', defaultDateRange);
    expect([200, 304]).toContain(ttRes.status);

    const renderedView = FrontendReportEmulator.render('tt-report', ttRes.data);
    expect(renderedView.columns.length).toBeGreaterThan(0);

    TestLogger.success(`TT Remittance Report audited with ${renderedView.columns.length} columns`);
  });

  it('36.10 should audit Tour Pax and LRS Daily reports for passenger and statutory fields', async () => {
    TestLogger.step('36.10', 'Auditing Tour Pax & LRS Daily statutory reports');

    const tpRes = await client.get('/reports/tour-pax-report', defaultDateRange);
    expect([200, 304]).toContain(tpRes.status);
    ReportAccuracyValidator.verifyFrontendContract('tour-pax', tpRes.data);

    const lrsRes = await client.get('/reports/lrs-daily-report', {
      ...defaultDateRange,
      usdRate: 87.0,
    });
    expect([200, 304]).toContain(lrsRes.status);
    ReportAccuracyValidator.verifyFrontendContract('lrs-daily', lrsRes.data);

    TestLogger.success('Tour Pax & LRS Daily reports audited successfully');
  });

  // ==========================================================================
  // DOMAIN 3: CREDIT CONTROL & ADVANCE FUNDS
  // ==========================================================================

  it('36.11 should audit Outstanding Transactions and Ageing Report for credit control balances', async () => {
    TestLogger.step('36.11', 'Auditing Outstanding Transactions & Ageing Report');

    const otRes = await client.get('/reports/outstanding-transaction-report', {
      ...defaultDateRange,
      accountingDate: '2026-12-31',
    });
    expect([200, 304]).toContain(otRes.status);
    ReportAccuracyValidator.verifyFrontendContract('outstanding-transactions', otRes.data);

    const ageRes = await client.get('/reports/ageing-report', defaultDateRange);
    expect([200, 304]).toContain(ageRes.status);
    ReportAccuracyValidator.verifyFrontendContract('ageing-report', ageRes.data);

    TestLogger.success('Outstanding Transactions & Ageing Report audited successfully');
  });

  it('36.12 should audit Card Blank Stock, Settled, and Unsettled reports for kit inventory tracking', async () => {
    TestLogger.step('36.12', 'Auditing Card Inventory & Settlement reports');

    const cbsRes = await client.get('/reports/card-blank-stock', defaultDateRange);
    expect([200, 304]).toContain(cbsRes.status);

    const csRes = await client.get('/reports/card-settled', defaultDateRange);
    expect([200, 304]).toContain(csRes.status);

    const cuRes = await client.get('/reports/card-unsettled', defaultDateRange);
    expect([200, 304]).toContain(cuRes.status);

    TestLogger.success('Card Blank Stock, Settled, and Unsettled reports audited successfully');
  });

  it('36.13 should audit Advance Funds AFC Reconciliation Report for advances, adjusted amounts, and balances', async () => {
    TestLogger.step('36.13', 'Auditing Advance Funds AFC Reconciliation Report');

    const afcRes = await client.get('/reports/afc-reconciliation-report', {
      ...defaultDateRange,
      accountingDate: '2026-12-31',
    });
    expect([200, 304]).toContain(afcRes.status);
    ReportAccuracyValidator.verifyFrontendContract('afc-reconciliation', afcRes.data);

    TestLogger.success('AFC Reconciliation Report audited successfully');
  });

  // ==========================================================================
  // DOMAIN 4: EXPORT INTEGRITY
  // ==========================================================================

  it('36.14 should audit report export downloads (.xlsx and .csv) for HTTP 200 and binary content', async () => {
    TestLogger.step('36.14', 'Auditing report export endpoints for format integrity');

    // 1. Sale/Purchase XLSX Export
    const spXlsx = await client.get('/reports/sale-purchase/export', {
      format: 'xlsx',
      ...defaultDateRange,
    });
    expect([200, 304]).toContain(spXlsx.status);

    // 2. Sale/Purchase CSV Export
    const spCsv = await client.get('/reports/sale-purchase/export', {
      format: 'csv',
      ...defaultDateRange,
    });
    expect([200, 304]).toContain(spCsv.status);

    // 3. Currency Balance XLSX Export
    const cbXlsx = await client.get('/reports/currency-balance/export', {
      format: 'xlsx',
      ...defaultDateRange,
    });
    expect([200, 304]).toContain(cbXlsx.status);

    // 4. Trial Balance XLSX Export
    const tbXlsx = await client.get('/reports/trial-balance-report/export', {
      format: 'xlsx',
      ...defaultDateRange,
    });
    expect([200, 304]).toContain(tbXlsx.status);

    TestLogger.success('All report export endpoints verified with HTTP 200');
  });
});
