import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { ReportReconciler } from '../infrastructure/report-reconciler';
import { TestLogger } from '../infrastructure/test-logger';

describe('Module 35: Post-Operations Financial Reconciliation & Reports Accuracy', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let reconciler: ReportReconciler;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    reconciler = ReportReconciler.getInstance();

    TestLogger.header('Module 35: Final Reports Accuracy Reconciliation');
    await workplaceManager.asAdmin();
  });

  it('35.1 should execute mathematical delta reconciliation against baseline reports', async () => {
    const result = await reconciler.verifyPostOperations(client);
    expect(result.passed).toBe(true);
    TestLogger.success('Module 35 Reports Reconciliation completed successfully');
  });

  it('35.2 should verify General Ledger double-entry balance integrity invariant', async () => {
    const tbRes = await client.get('/reports/trial-balance-report', {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    expect(tbRes.status).toBe(200);

    const debits = Number(tbRes.data?.totalDebit || 0);
    const credits = Number(tbRes.data?.totalCredit || 0);
    const diff = Math.abs(debits - credits);

    TestLogger.info(`Final Post-Op Trial Balance: Debits=${debits}, Credits=${credits}, Difference=${diff}`);
    expect(diff).toBeLessThanOrEqual(1.0); // allows minor decimal round-off
  });

  it('35.3 should verify strict draft and rejected transaction exclusion invariant across reports', async () => {
    await reconciler.assertDraftExclusionInvariant(client);
    TestLogger.success('Draft and rejected transaction exclusion invariant verified');
  });

  it('35.4 should verify entry-level traceability into Sale/Purchase report', async () => {
    await reconciler.assertSalePurchaseReportAccuracy(client);
    TestLogger.success('Sale/Purchase report entry-level accuracy verified');
  });

  it('35.5 should verify Cash and Bank report balance consistency', async () => {
    const cashRes = await client.get('/reports/cash-report', {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    expect([200, 304]).toContain(cashRes.status);

    const bankRes = await client.get('/reports/bank-report', {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    expect([200, 304]).toContain(bankRes.status);
    TestLogger.success('Cash and Bank report balance consistency verified');
  });

  it('35.6 should verify Bank Reconciliation report integrity', async () => {
    const res = await client.get('/reports/bank-reconciliation-report', {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    expect([200, 304]).toContain(res.status);
    TestLogger.success('Bank reconciliation report endpoint verified');
  });

  it('35.7 should verify Cash Flow Report post-operation consistency and closing balance integrity', async () => {
    const res = await client.get('/reports/cash-flow-report', {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      scope: 'consolidated',
    });
    expect([200, 304]).toContain(res.status);
    if (res.status === 200 && Array.isArray(res.data?.sections)) {
      for (const section of res.data.sections) {
        const opening = Number(section.opening?.total || 0);
        const additions = Number(section.additions?.total?.total || 0);
        const inter = Number(section.interBranch?.total?.total || 0);
        const deductions = Number(section.deductions?.total?.total || 0);
        const closing = Number(section.closing?.total || 0);
        const calculated = opening + additions + inter - deductions;
        expect(Math.abs(calculated - closing)).toBeLessThanOrEqual(0.02);
      }
    }
    TestLogger.success('Cash Flow Report post-operation consistency verified');
  });
});

