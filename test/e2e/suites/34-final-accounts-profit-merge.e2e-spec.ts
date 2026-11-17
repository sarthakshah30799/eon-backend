import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';

describe('Module 34: Final Accounts, Profit Merging & Reconciliation Reports', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 34: Final Accounts, Profit Merging & Reconciliation Reports');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  const defaultDateRange = {
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  };

  it('34.1 should retrieve Final Account Report - Trading statement without profit merge', async () => {
    const res = await client.get('/reports/final-account-report', {
      ...defaultDateRange,
      statementType: 'trading',
      mergeProfit: false,
      branchIds: registry.masters.branchA?.id ? [registry.masters.branchA.id] : undefined,
    });

    expect(res.status).toBe(200);
    expect(res.data?.statementType).toBe('trading');
    expect(res.data?.mergeProfit).toBe(false);
    expect(Array.isArray(res.data?.debitColumns)).toBe(true);
    expect(Array.isArray(res.data?.creditColumns)).toBe(true);
    expect(Array.isArray(res.data?.sections)).toBe(true);
    TestLogger.success('Trading statement without merge profit retrieved successfully');
  });

  it('34.2 should retrieve Final Account Report - Trading statement with profit merge enabled', async () => {
    const res = await client.get('/reports/final-account-report', {
      ...defaultDateRange,
      statementType: 'trading',
      mergeProfit: true,
      branchIds: registry.masters.branchA?.id ? [registry.masters.branchA.id] : undefined,
    });

    expect(res.status).toBe(200);
    expect(res.data?.statementType).toBe('trading');
    expect(res.data?.mergeProfit).toBe(true);
    expect(Array.isArray(res.data?.sections)).toBe(true);
    TestLogger.success('Trading statement with mergeProfit=true retrieved successfully');
  });

  it('34.3 should retrieve Final Account Report - Profit & Loss statement', async () => {
    const res = await client.get('/reports/final-account-report', {
      ...defaultDateRange,
      statementType: 'profit-and-loss',
      branchIds: registry.masters.branchA?.id ? [registry.masters.branchA.id] : undefined,
    });

    expect(res.status).toBe(200);
    expect(res.data?.statementType).toBe('profit-and-loss');
    TestLogger.success('Profit & Loss statement retrieved successfully');
  });

  it('34.4 should retrieve Final Account Report - Balance Sheet statement', async () => {
    const res = await client.get('/reports/final-account-report', {
      ...defaultDateRange,
      statementType: 'balance-sheet',
      branchIds: registry.masters.branchA?.id ? [registry.masters.branchA.id] : undefined,
    });

    expect(res.status).toBe(200);
    expect(res.data?.statementType).toBe('balance-sheet');
    TestLogger.success('Balance Sheet statement retrieved successfully');
  });

  it('34.5 should export Final Account Report with mergeProfit as XLSX and CSV', async () => {
    const xlsxRes = await client.get('/reports/final-account-report/export', {
      ...defaultDateRange,
      statementType: 'trading',
      mergeProfit: true,
      format: 'xlsx',
      branchIds: registry.masters.branchA?.id ? [registry.masters.branchA.id] : undefined,
    });
    expect(xlsxRes.status).toBe(200);
    expect(xlsxRes.headers.get('content-disposition') || '').toContain('attachment');

    const csvRes = await client.get('/reports/final-account-report/export', {
      ...defaultDateRange,
      statementType: 'trading',
      mergeProfit: true,
      format: 'csv',
      branchIds: registry.masters.branchA?.id ? [registry.masters.branchA.id] : undefined,
    });
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers.get('content-disposition') || '').toContain('attachment');
    TestLogger.success('Final Account Report exported in XLSX and CSV formats successfully');
  });

  it('34.6 should retrieve Trial Balance Report with mergeProfit=false and mergeProfit=true', async () => {
    const unmergedRes = await client.get('/reports/trial-balance-report', {
      ...defaultDateRange,
      mergeProfit: false,
      branchIds: registry.masters.branchA?.id ? [registry.masters.branchA.id] : undefined,
    });
    expect(unmergedRes.status).toBe(200);
    expect(unmergedRes.data?.mergeProfit).toBe(false);
    expect(Array.isArray(unmergedRes.data?.rows)).toBe(true);

    const mergedRes = await client.get('/reports/trial-balance-report', {
      ...defaultDateRange,
      mergeProfit: true,
      branchIds: registry.masters.branchA?.id ? [registry.masters.branchA.id] : undefined,
    });
    expect(mergedRes.status).toBe(200);
    expect(mergedRes.data?.mergeProfit).toBe(true);
    expect(Array.isArray(mergedRes.data?.rows)).toBe(true);
    TestLogger.success('Trial Balance retrieved with unmerged and merged profit modes');
  });

  it('34.7 should retrieve Trial Balance Report grouped by financial structure (groupBy=true, mergeProfit=true)', async () => {
    const groupedRes = await client.get('/reports/trial-balance-report', {
      ...defaultDateRange,
      groupBy: true,
      mergeProfit: true,
      branchIds: registry.masters.branchA?.id ? [registry.masters.branchA.id] : undefined,
    });
    expect(groupedRes.status).toBe(200);
    expect(groupedRes.data?.groupBy).toBe(true);
    expect(groupedRes.data?.mergeProfit).toBe(true);
    expect(Array.isArray(groupedRes.data?.rows)).toBe(true);
    TestLogger.success('Trial Balance grouped hierarchy with merged profit retrieved successfully');
  });

  it('34.8 should export Trial Balance Report as XLSX', async () => {
    const res = await client.get('/reports/trial-balance-report/export', {
      ...defaultDateRange,
      mergeProfit: true,
      format: 'xlsx',
      branchIds: registry.masters.branchA?.id ? [registry.masters.branchA.id] : undefined,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition') || '').toContain('attachment');
    TestLogger.success('Trial Balance Report exported in XLSX format successfully');
  });

  it('34.9 should retrieve AFC Reconciliation Report in detail and summary layouts with export', async () => {
    const accountingDate = '2026-12-31';

    const detailRes = await client.get('/reports/afc-reconciliation-report', {
      ...defaultDateRange,
      accountingDate,
      layout: 'detail',
      branchIds: registry.masters.branchA?.id ? [registry.masters.branchA.id] : undefined,
    });
    expect(detailRes.status).toBe(200);
    expect(detailRes.data?.layout).toBe('detail');
    expect(Array.isArray(detailRes.data?.columns)).toBe(true);
    expect(Array.isArray(detailRes.data?.rows)).toBe(true);

    const summaryRes = await client.get('/reports/afc-reconciliation-report', {
      ...defaultDateRange,
      accountingDate,
      layout: 'summary',
      branchIds: registry.masters.branchA?.id ? [registry.masters.branchA.id] : undefined,
    });
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.data?.layout).toBe('summary');

    const exportRes = await client.get('/reports/afc-reconciliation-report/export', {
      ...defaultDateRange,
      accountingDate,
      format: 'xlsx',
      branchIds: registry.masters.branchA?.id ? [registry.masters.branchA.id] : undefined,
    });
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get('content-disposition') || '').toContain('attachment');
    TestLogger.success('AFC Reconciliation Report verified in detail, summary, and export');
  });

  it('34.10 should retrieve Bank Reconciliation Report in BRANCH_WISE and CONSOLIDATED layouts with export', async () => {
    const bankAccountId = registry.masters.bankAccountId;

    const branchWiseRes = await client.get('/reports/bank-reconciliation-report', {
      ...defaultDateRange,
      layout: 'BRANCH_WISE',
      accountIds: bankAccountId ? [bankAccountId] : undefined,
      branchIds: registry.masters.branchA?.id ? [registry.masters.branchA.id] : undefined,
    });
    expect(branchWiseRes.status).toBe(200);
    expect(branchWiseRes.data?.layout).toBe('BRANCH_WISE');
    expect(Array.isArray(branchWiseRes.data?.sections)).toBe(true);

    const consolidatedRes = await client.get('/reports/bank-reconciliation-report', {
      ...defaultDateRange,
      layout: 'CONSOLIDATED',
      accountIds: bankAccountId ? [bankAccountId] : undefined,
      branchIds: registry.masters.branchA?.id ? [registry.masters.branchA.id] : undefined,
    });
    expect(consolidatedRes.status).toBe(200);
    expect(consolidatedRes.data?.layout).toBe('CONSOLIDATED');

    const exportRes = await client.get('/reports/bank-reconciliation-report/export', {
      ...defaultDateRange,
      layout: 'BRANCH_WISE',
      accountIds: bankAccountId ? [bankAccountId] : undefined,
      format: 'xlsx',
    });
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get('content-disposition') || '').toContain('attachment');
    TestLogger.success('Bank Reconciliation Report verified across layouts and export');
  });

  it('34.11 should retrieve General Ledger Report in detail and columnar views with export', async () => {
    const cashAccountId = registry.masters.cashAccountId;

    const ledgerRes = await client.get('/reports/general-ledger-report', {
      ...defaultDateRange,
      layout: 'detail',
      view: 'ledger',
      accountIds: cashAccountId ? [cashAccountId] : undefined,
      branchIds: registry.masters.branchA?.id ? [registry.masters.branchA.id] : undefined,
    });
    expect(ledgerRes.status).toBe(200);
    expect(ledgerRes.data?.view).toBe('ledger');
    expect(Array.isArray(ledgerRes.data?.sections)).toBe(true);

    const columnarRes = await client.get('/reports/general-ledger-report', {
      ...defaultDateRange,
      layout: 'detail',
      view: 'columnar',
      accountIds: cashAccountId ? [cashAccountId] : undefined,
      branchIds: registry.masters.branchA?.id ? [registry.masters.branchA.id] : undefined,
    });
    expect(columnarRes.status).toBe(200);
    expect(columnarRes.data?.view).toBe('columnar');

    const exportRes = await client.get('/reports/general-ledger-report/export', {
      ...defaultDateRange,
      layout: 'detail',
      view: 'ledger',
      accountIds: cashAccountId ? [cashAccountId] : undefined,
      format: 'xlsx',
    });
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get('content-disposition') || '').toContain('attachment');
    TestLogger.success('General Ledger Report verified in ledger, columnar views and export');
  });

  it('34.11B should retrieve Final Accounts, Trial Balance, and General Ledger in CONSOLIDATED scope', async () => {
    const consolFaRes = await client.get('/reports/final-account-report', {
      ...defaultDateRange,
      statementType: 'balance-sheet',
      scope: 'consolidated',
      mergeProfit: true,
    });
    expect(consolFaRes.status).toBe(200);
    expect(consolFaRes.data?.scope).toBe('consolidated');

    const consolTbRes = await client.get('/reports/trial-balance-report', {
      ...defaultDateRange,
      scope: 'consolidated',
      mergeProfit: true,
    });
    expect(consolTbRes.status).toBe(200);
    expect(consolTbRes.data?.scope).toBe('consolidated');

    const consolGlRes = await client.get('/reports/general-ledger-report', {
      ...defaultDateRange,
      layout: 'summary',
      scope: 'consolidated',
      view: 'ledger',
    });
    expect(consolGlRes.status).toBe(200);
    expect(consolGlRes.data?.scope).toBe('consolidated');
    expect(consolGlRes.data?.layout).toBe('summary');

    const consolAfcRes = await client.get('/reports/afc-reconciliation-report', {
      ...defaultDateRange,
      accountingDate: '2026-12-31',
      scope: 'consolidated',
      layout: 'summary',
    });
    expect(consolAfcRes.status).toBe(200);
    expect(consolAfcRes.data?.scope).toBe('consolidated');
    TestLogger.success('Consolidated scope verified across Final Accounts, TB, GL, and AFC Reconciliation');
  });

  it('34.12 should retrieve Cash Flow Report in BRANCH scope and verify mathematical balance invariant', async () => {
    const res = await client.get('/reports/cash-flow-report', {
      ...defaultDateRange,
      scope: 'branch',
    });

    expect(res.status).toBe(200);
    expect(res.data?.startDate).toBe(defaultDateRange.startDate);
    expect(res.data?.endDate).toBe(defaultDateRange.endDate);
    expect(res.data?.scope).toBe('branch');
    expect(Array.isArray(res.data?.columns)).toBe(true);
    expect(Array.isArray(res.data?.sections)).toBe(true);

    const columnKeys = (res.data.columns as Array<{ key: string }>).map((c) => c.key);
    expect(columnKeys).toEqual(expect.arrayContaining(['description', 'bank', 'cash', 'total']));

    for (const section of res.data.sections) {
      expect(section.opening).toBeDefined();
      expect(section.additions).toBeDefined();
      expect(section.interBranch).toBeDefined();
      expect(section.deductions).toBeDefined();
      expect(section.closing).toBeDefined();

      // Check sum of line items matches section total
      const calcAdditionsBank = (section.additions.lines || []).reduce((sum: number, l: any) => sum + Number(l.bank || 0), 0);
      const calcAdditionsCash = (section.additions.lines || []).reduce((sum: number, l: any) => sum + Number(l.cash || 0), 0);
      expect(Math.abs(calcAdditionsBank - Number(section.additions.total.bank))).toBeLessThanOrEqual(0.02);
      expect(Math.abs(calcAdditionsCash - Number(section.additions.total.cash))).toBeLessThanOrEqual(0.02);

      const calcDeductionsBank = (section.deductions.lines || []).reduce((sum: number, l: any) => sum + Number(l.bank || 0), 0);
      const calcDeductionsCash = (section.deductions.lines || []).reduce((sum: number, l: any) => sum + Number(l.cash || 0), 0);
      expect(Math.abs(calcDeductionsBank - Number(section.deductions.total.bank))).toBeLessThanOrEqual(0.02);
      expect(Math.abs(calcDeductionsCash - Number(section.deductions.total.cash))).toBeLessThanOrEqual(0.02);

      // Verify fundamental Cash Flow mathematical identity:
      // Closing = Opening + Additions + InterBranch - Deductions
      const openingBank = Number(section.opening.bank || 0);
      const additionsBank = Number(section.additions.total.bank || 0);
      const interBank = Number(section.interBranch.total.bank || 0);
      const deductionsBank = Number(section.deductions.total.bank || 0);
      const closingBank = Number(section.closing.bank || 0);
      expect(Math.abs(openingBank + additionsBank + interBank - deductionsBank - closingBank)).toBeLessThanOrEqual(0.02);

      const openingCash = Number(section.opening.cash || 0);
      const additionsCash = Number(section.additions.total.cash || 0);
      const interCash = Number(section.interBranch.total.cash || 0);
      const deductionsCash = Number(section.deductions.total.cash || 0);
      const closingCash = Number(section.closing.cash || 0);
      expect(Math.abs(openingCash + additionsCash + interCash - deductionsCash - closingCash)).toBeLessThanOrEqual(0.02);

      expect(Math.abs((closingBank + closingCash) - Number(section.closing.total || 0))).toBeLessThanOrEqual(0.02);
    }
    TestLogger.success('Cash Flow Report verified in BRANCH scope with mathematical identity');
  });

  it('34.13 should retrieve Cash Flow Report in CONSOLIDATED scope', async () => {
    const res = await client.get('/reports/cash-flow-report', {
      ...defaultDateRange,
      scope: 'consolidated',
    });

    expect(res.status).toBe(200);
    expect(res.data?.scope).toBe('consolidated');
    expect(Array.isArray(res.data?.sections)).toBe(true);

    for (const section of res.data.sections) {
      const opening = Number(section.opening.total || 0);
      const additions = Number(section.additions.total.total || 0);
      const inter = Number(section.interBranch.total.total || 0);
      const deductions = Number(section.deductions.total.total || 0);
      const closing = Number(section.closing.total || 0);
      expect(Math.abs(opening + additions + inter - deductions - closing)).toBeLessThanOrEqual(0.02);
    }
    TestLogger.success('Cash Flow Report verified in CONSOLIDATED scope');
  });

  it('34.14 should filter Cash Flow Report by branch and accounts', async () => {
    const branchAId = registry.masters.branchA?.id;
    const cashAccountId = registry.masters.cashAccountId;

    const res = await client.get('/reports/cash-flow-report', {
      ...defaultDateRange,
      branchIds: branchAId ? [branchAId] : undefined,
      accountIds: cashAccountId ? [cashAccountId] : undefined,
      scope: 'branch',
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data?.sections)).toBe(true);
    if (branchAId && res.data.sections.length > 0) {
      for (const section of res.data.sections) {
        if (section.branchId) {
          expect(section.branchId).toBe(branchAId);
        }
      }
    }
    TestLogger.success('Cash Flow Report filtering by branch and account verified');
  });

  it('34.15 should export Cash Flow Report as XLSX and CSV formats', async () => {
    const xlsxRes = await client.get('/reports/cash-flow-report/export', {
      ...defaultDateRange,
      format: 'xlsx',
      scope: 'consolidated',
    });
    expect(xlsxRes.status).toBe(200);
    expect(xlsxRes.headers.get('content-disposition') || '').toContain('attachment');
    expect(xlsxRes.headers.get('content-disposition') || '').toContain('.xlsx');

    const csvRes = await client.get('/reports/cash-flow-report/export', {
      ...defaultDateRange,
      format: 'csv',
      scope: 'consolidated',
    });
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers.get('content-disposition') || '').toContain('attachment');
    expect(csvRes.headers.get('content-disposition') || '').toContain('.csv');
    TestLogger.success('Cash Flow Report exported in XLSX and CSV formats successfully');
  });

  it('34.16 should reject invalid date range where startDate > endDate', async () => {
    const res = await client.get('/reports/cash-flow-report', {
      startDate: '2026-12-31',
      endDate: '2026-01-01',
    });
    expect(res.status).toBe(400);
    TestLogger.success('Cash Flow Report correctly rejected inverted date range with 400');
  });

  it('34.17 should reject request with missing required startDate or endDate', async () => {
    const missingStartRes = await client.get('/reports/cash-flow-report', {
      endDate: '2026-12-31',
    });
    expect(missingStartRes.status).toBe(400);

    const missingEndRes = await client.get('/reports/cash-flow-report', {
      startDate: '2026-01-01',
    });
    expect(missingEndRes.status).toBe(400);
    TestLogger.success('Cash Flow Report correctly rejected missing required date parameters');
  });

  it('34.18 should reject request with malformed date strings', async () => {
    const res = await client.get('/reports/cash-flow-report', {
      startDate: 'invalid-date-format',
      endDate: '2026-12-31',
    });
    expect(res.status).toBe(400);
    TestLogger.success('Cash Flow Report correctly rejected malformed date string');
  });

  it('34.19 should reject request with invalid UUID format in filter arrays', async () => {
    const res = await client.get('/reports/cash-flow-report', {
      ...defaultDateRange,
      branchIds: ['not-a-valid-uuid'],
    });
    expect(res.status).toBe(400);
    TestLogger.success('Cash Flow Report correctly rejected non-UUID filter parameter');
  });

  it('34.20 should gracefully handle non-existent branch ID without server error', async () => {
    const nonExistentBranchId = 'a0000000-0000-4000-8000-000000000000';
    const res = await client.get('/reports/cash-flow-report', {
      ...defaultDateRange,
      branchIds: [nonExistentBranchId],
      scope: 'branch',
    });
    expect([200, 400]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Cash Flow Report gracefully handled non-existent branch filter');
  });

  it('34.21 should verify positive and negative net cash flow handling across sections', async () => {
    const res = await client.get('/reports/cash-flow-report', {
      ...defaultDateRange,
      scope: 'branch',
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data?.sections)).toBe(true);

    for (const section of res.data.sections) {
      const opening = Number(section.opening?.total || 0);
      const additions = Number(section.additions?.total?.total || 0);
      const inter = Number(section.interBranch?.total?.total || 0);
      const deductions = Number(section.deductions?.total?.total || 0);
      const closing = Number(section.closing?.total || 0);

      // Net period flow (can be positive when inflows > outflows, or negative when outflows > inflows)
      const netPeriodFlow = additions + inter - deductions;
      const expectedClosing = opening + netPeriodFlow;

      // Both positive net cash flow and negative net cash flow (overdraft/drawdown) must satisfy balance
      expect(Math.abs(expectedClosing - closing)).toBeLessThanOrEqual(0.02);

      // Verify sign consistency: if opening is 0 and net flow is negative, closing must be negative
      if (Math.abs(opening) < 0.001) {
        if (netPeriodFlow < -0.01) {
          expect(closing).toBeLessThan(0);
        } else if (netPeriodFlow > 0.01) {
          expect(closing).toBeGreaterThan(0);
        }
      }
    }
    TestLogger.success('Cash Flow Report positive and negative net flow arithmetic verified');
  });

  it('34.22 should enforce authentication guard on Cash Flow endpoints', async () => {
    const unauthedClient = new ApiClient();
    unauthedClient.clearCookies();

    const reportRes = await unauthedClient.get('/reports/cash-flow-report', defaultDateRange);
    expect([401, 403]).toContain(reportRes.status);

    const exportRes = await unauthedClient.get('/reports/cash-flow-report/export', {
      ...defaultDateRange,
      format: 'xlsx',
    });
    expect([401, 403]).toContain(exportRes.status);
    TestLogger.success('Cash Flow Report authentication guards verified');
  });
});

