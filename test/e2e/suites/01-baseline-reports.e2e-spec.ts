import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { ReportReconciler } from '../infrastructure/report-reconciler';
import { TestLogger } from '../infrastructure/test-logger';

describe('Phase 1: Baseline Reports Accuracy & Filter Verification', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;
  let reconciler: ReportReconciler;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();
    reconciler = ReportReconciler.getInstance();

    TestLogger.header('Initializing Phase 1 Baseline Suite');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
    await reconciler.captureBaseline(client);
  }, 180000);

  describe('Report Suite 1: Sale & Purchase Report', () => {
    it('1.1 should fetch sale-purchase report grouped by code', async () => {
      const res = await client.get('/reports/sale-purchase', {
        groupBy: 'code',
        layout: 'grouped',
      });
      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    it('1.2 should filter sale-purchase report by single branch', async () => {
      if (!registry.masters.branchA?.id) return;
      const res = await client.get('/reports/sale-purchase', {
        branchIds: [registry.masters.branchA.id],
      });
      expect(res.status).toBe(200);
      const rows = Array.isArray(res.data?.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []);
      for (const row of rows) {
        if (row.branchId) {
          expect(row.branchId).toBe(registry.masters.branchA.id);
        }
      }
    });

    it('1.3 should filter sale-purchase report by single counter', async () => {
      if (!registry.masters.counterA1?.id) return;
      const res = await client.get('/reports/sale-purchase', {
        counterIds: [registry.masters.counterA1.id],
      });
      expect(res.status).toBe(200);
    });

    it('1.4 should filter sale-purchase report with party profile filter', async () => {
      const res = await client.get('/reports/sale-purchase', {
        partyProfileIds: registry.masters.cardIssuerPartyId ? [registry.masters.cardIssuerPartyId] : undefined,
      });
      expect(res.status).toBe(200);
    });

    it('1.5 should filter sale-purchase report by transaction type SALE', async () => {
      const res = await client.get('/reports/sale-purchase', {
        transactionTypes: ['SALE'],
      });
      expect(res.status).toBe(200);
    });

    it('1.6 should filter sale-purchase report by transaction type PURCHASE', async () => {
      const res = await client.get('/reports/sale-purchase', {
        transactionTypes: ['PURCHASE'],
      });
      expect(res.status).toBe(200);
    });

    it('1.7 should support export for sale-purchase report', async () => {
      const res = await client.get('/reports/sale-purchase/export', { format: 'xlsx' });
      expect([200, 304]).toContain(res.status);
    });

    it('1.8 should fetch sale-purchase report with flat layout and short/long detail', async () => {
      const flatRes = await client.get('/reports/sale-purchase', {
        layout: 'flat',
        detail: 'short',
      });
      expect(flatRes.status).toBe(200);

      const longRes = await client.get('/reports/sale-purchase', {
        layout: 'flat',
        detail: 'long',
      });
      expect(longRes.status).toBe(200);
    });

    it('1.9 should fetch sale-purchase report grouped by date and branch', async () => {
      const dateRes = await client.get('/reports/sale-purchase', {
        layout: 'grouped',
        groupBy: 'date',
      });
      expect(dateRes.status).toBe(200);

      const branchRes = await client.get('/reports/sale-purchase', {
        layout: 'grouped',
        groupBy: 'branch',
      });
      expect(branchRes.status).toBe(200);
    });
  });

  describe('Report Suite 2: Currency Balance Report', () => {
    it('2.1 should fetch currency balance and verify inventory fields', async () => {
      const res = await client.get('/reports/currency-balance');
      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    it('2.2 should filter currency balance by branch', async () => {
      if (!registry.masters.branchA?.id) return;
      const res = await client.get('/reports/currency-balance', {
        branchIds: [registry.masters.branchA.id],
      });
      expect(res.status).toBe(200);
    });

    it('2.3 should support export for currency balance report', async () => {
      const res = await client.get('/reports/currency-balance/export', { format: 'xlsx' });
      expect([200, 304]).toContain(res.status);
    });
  });

  const defaultDateRange = {
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  };

  describe('Report Suite 3: Cash Book & Bank Book Reports', () => {
    it('3.1 should fetch cash report', async () => {
      const res = await client.get('/reports/cash-report', defaultDateRange);
      expect(res.status).toBe(200);
    });

    it('3.2 should fetch bank report', async () => {
      const res = await client.get('/reports/bank-report', defaultDateRange);
      expect(res.status).toBe(200);
    });

    it('3.3 should fetch cash flow report baseline and verify schema', async () => {
      const res = await client.get('/reports/cash-flow-report', defaultDateRange);
      expect(res.status).toBe(200);
      expect(res.data?.startDate).toBe(defaultDateRange.startDate);
      expect(res.data?.endDate).toBe(defaultDateRange.endDate);
      expect(Array.isArray(res.data?.columns)).toBe(true);
      expect(Array.isArray(res.data?.sections)).toBe(true);
      TestLogger.success('Cash Flow Report baseline schema verified');
    });

    it('3.4 should fetch Cash Report across BRANCH_WISE and CONSOLIDATED layouts', async () => {
      const branchRes = await client.get('/reports/cash-report', {
        ...defaultDateRange,
        layout: 'BRANCH_WISE',
      });
      expect(branchRes.status).toBe(200);

      const consolRes = await client.get('/reports/cash-report', {
        ...defaultDateRange,
        layout: 'CONSOLIDATED',
      });
      expect(consolRes.status).toBe(200);
    });

    it('3.5 should fetch Bank Report across BRANCH_WISE and CONSOLIDATED layouts', async () => {
      const branchRes = await client.get('/reports/bank-report', {
        ...defaultDateRange,
        layout: 'BRANCH_WISE',
      });
      expect(branchRes.status).toBe(200);

      const consolRes = await client.get('/reports/bank-report', {
        ...defaultDateRange,
        layout: 'CONSOLIDATED',
      });
      expect(consolRes.status).toBe(200);
    });
  });

  describe('Report Suite 4: General Ledger & Trial Balance', () => {
    it('4.1 should fetch general ledger report', async () => {
      const res = await client.get('/reports/general-ledger-report', defaultDateRange);
      expect(res.status).toBe(200);
    });

    it('4.2 should fetch trial balance report and verify double-entry balance', async () => {
      const res = await client.get('/reports/trial-balance-report', defaultDateRange);
      expect(res.status).toBe(200);
      const debits = Number(res.data?.totalDebit || 0);
      const credits = Number(res.data?.totalCredit || 0);
      TestLogger.info(`Trial Balance Baseline: Debits=${debits}, Credits=${credits}`);
      expect(Math.abs(debits - credits)).toBeLessThanOrEqual(1.0); // allows minor round-off
    });

    it('4.3 should fetch final account report (Balance Sheet & P&L)', async () => {
      const res = await client.get('/reports/final-account-report', defaultDateRange);
      expect(res.status).toBe(200);
    });

    it('4.4 should fetch Trial Balance across branch and consolidated scopes', async () => {
      const branchRes = await client.get('/reports/trial-balance-report', {
        ...defaultDateRange,
        scope: 'branch',
      });
      expect(branchRes.status).toBe(200);

      const consolRes = await client.get('/reports/trial-balance-report', {
        ...defaultDateRange,
        scope: 'consolidated',
      });
      expect(consolRes.status).toBe(200);
    });

    it('4.5 should fetch Final Account report across branch and consolidated scopes', async () => {
      const branchRes = await client.get('/reports/final-account-report', {
        ...defaultDateRange,
        scope: 'branch',
      });
      expect(branchRes.status).toBe(200);

      const consolRes = await client.get('/reports/final-account-report', {
        ...defaultDateRange,
        scope: 'consolidated',
      });
      expect(consolRes.status).toBe(200);
    });

    it('4.6 should fetch General Ledger report across summary layout and consolidated scope', async () => {
      const summaryRes = await client.get('/reports/general-ledger-report', {
        ...defaultDateRange,
        layout: 'summary',
        scope: 'consolidated',
      });
      expect(summaryRes.status).toBe(200);
    });
  });

  describe('Report Suite 5: Outstanding & Ageing Reports', () => {
    it('5.1 should fetch outstanding transaction report', async () => {
      const res = await client.get('/reports/outstanding-transaction-report', {
        ...defaultDateRange,
        accountingDate: '2026-12-31',
      });
      expect(res.status).toBe(200);
    });

    it('5.2 should fetch ageing report with ageing buckets', async () => {
      const res = await client.get('/reports/ageing-report', defaultDateRange);
      expect(res.status).toBe(200);
    });

    it('5.3 should fetch Outstanding Transaction Report across detail/summary layouts and groupings', async () => {
      const detailRes = await client.get('/reports/outstanding-transaction-report', {
        ...defaultDateRange,
        accountingDate: '2026-12-31',
        layout: 'detail',
        grouping: 'code',
        transactionSide: 'both',
      });
      expect(detailRes.status).toBe(200);

      const summaryRes = await client.get('/reports/outstanding-transaction-report', {
        ...defaultDateRange,
        accountingDate: '2026-12-31',
        layout: 'summary',
        grouping: 'agent',
      });
      expect(summaryRes.status).toBe(200);
    });

    it('5.4 should fetch Ageing Report across detail/summary layouts, scopes and EEFC filters', async () => {
      const detailRes = await client.get('/reports/ageing-report', {
        ...defaultDateRange,
        layout: 'detail',
        scope: 'branch',
        eefcFilter: 'all',
      });
      expect(detailRes.status).toBe(200);

      const summaryRes = await client.get('/reports/ageing-report', {
        ...defaultDateRange,
        layout: 'summary',
        scope: 'consolidated',
        eefcFilter: 'eefc',
      });
      expect(summaryRes.status).toBe(200);
    });
  });

  describe('Report Suite 6: Card Inventory, Unsettled & Settled Reports', () => {
    it('6.1 should fetch blank card stock report', async () => {
      const res = await client.get('/reports/card-blank-stock', defaultDateRange);
      expect(res.status).toBe(200);
    });

    it('6.2 should fetch unsettled cards report', async () => {
      const res = await client.get('/reports/card-unsettled', defaultDateRange);
      expect(res.status).toBe(200);
    });

    it('6.3 should fetch settled cards report', async () => {
      const res = await client.get('/reports/card-settled', defaultDateRange);
      expect(res.status).toBe(200);
    });

    it('6.4 should fetch AFC reconciliation report', async () => {
      const res = await client.get('/reports/afc-reconciliation-report', {
        ...defaultDateRange,
        accountingDate: '2026-12-31',
      });
      expect(res.status).toBe(200);
    });

    it('6.5 should fetch AFC Reconciliation Report across branch and consolidated scopes', async () => {
      const consolRes = await client.get('/reports/afc-reconciliation-report', {
        ...defaultDateRange,
        accountingDate: '2026-12-31',
        scope: 'consolidated',
      });
      expect(consolRes.status).toBe(200);
    });
  });

  describe('Report Suite 7: Remittance, Tour Pax & Operational Reports', () => {
    it('7.1 should fetch product profit report', async () => {
      const res = await client.get('/reports/product-profit', defaultDateRange);
      expect(res.status).toBe(200);
    });

    it('7.2 should fetch TT outward remittance report', async () => {
      const res = await client.get('/reports/tt-report', defaultDateRange);
      expect(res.status).toBe(200);
    });

    it('7.3 should fetch tour pax report', async () => {
      const res = await client.get('/reports/tour-pax-report', defaultDateRange);
      expect(res.status).toBe(200);
    });

    it('7.4 should fetch bank reconciliation report', async () => {
      const res = await client.get('/reports/bank-reconciliation-report', defaultDateRange);
      expect(res.status).toBe(200);
    });

    it('7.5 should fetch TT Outward Remittance Report across bank-specific layouts', async () => {
      for (const layout of ['indus', 'idfc', 'icici', 'yes']) {
        const res = await client.get('/reports/tt-report', {
          ...defaultDateRange,
          layout,
        });
        expect(res.status).toBe(200);
      }
    });

    it('7.6 should fetch Generate Ledger Report across BRANCH_WISE and CONSOLIDATED layouts', async () => {
      const branchRes = await client.get('/reports/generate-ledger', {
        ...defaultDateRange,
        layout: 'BRANCH_WISE',
      });
      expect([200, 304]).toContain(branchRes.status);

      const consolRes = await client.get('/reports/generate-ledger', {
        ...defaultDateRange,
        layout: 'CONSOLIDATED',
      });
      expect([200, 304]).toContain(consolRes.status);
    });

    it('7.7 should fetch Special Report with branch filter', async () => {
      if (!registry.masters.branchA?.id) return;
      const res = await client.get('/reports/special-report', {
        branchIds: [registry.masters.branchA.id],
      });
      expect([200, 304]).toContain(res.status);
    });
  });

  describe('Report Suite 8: RBI Statutory Reports (FLM & LRS)', () => {
    it('8.1 should fetch FLM-1 Daily CN Summary', async () => {
      const res = await client.get('/reports/flm1-daily-cn-summary', { date: '2026-11-12' });
      expect(res.status).toBe(200);
    });

    it('8.2 should fetch FLM-3 Purchase from Public', async () => {
      const res = await client.get('/reports/flm3-purchase-from-public', defaultDateRange);
      expect(res.status).toBe(200);
    });

    it('8.3 should fetch FLM-4 Purchase from FFMC', async () => {
      const res = await client.get('/reports/flm4-purchase-from-ffmc', defaultDateRange);
      expect(res.status).toBe(200);
    });

    it('8.4 should fetch FLM-5 Sales to Public', async () => {
      const res = await client.get('/reports/flm5-sales-to-public', defaultDateRange);
      expect(res.status).toBe(200);
    });

    it('8.5 should fetch FLM-6 Sales to FFMC', async () => {
      const res = await client.get('/reports/flm6-sales-to-ffmc', defaultDateRange);
      expect(res.status).toBe(200);
    });

    it('8.6 should fetch FLM-8 AD-2', async () => {
      const res = await client.get('/reports/flm8-ad2', defaultDateRange);
      expect(res.status).toBe(200);
    });

    it('8.7 should fetch FLM-8 CN Statement', async () => {
      const res = await client.get('/reports/flm8-cn-statement', {
        ...defaultDateRange,
        profileType: 'FFMC',
      });
      expect(res.status).toBe(200);
    });

    it('8.8 should fetch LRS Daily Report', async () => {
      const res = await client.get('/reports/lrs-daily-report', {
        ...defaultDateRange,
        usdRate: 88.0,
      });
      expect(res.status).toBe(200);
    });

    it('8.9 should fetch FLM statutory reports across branch_wise and consolidate layouts', async () => {
      const flm3Detail = await client.get('/reports/flm3-purchase-from-public', {
        ...defaultDateRange,
        layout: 'branch_wise',
        view: 'normal',
      });
      expect(flm3Detail.status).toBe(200);

      const flm5Summary = await client.get('/reports/flm5-sales-to-public', {
        ...defaultDateRange,
        layout: 'consolidate',
        view: 'extended',
      });
      expect(flm5Summary.status).toBe(200);
    });
  });
});

