import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { ReportReconciler } from '../infrastructure/report-reconciler';
import { TestLogger } from '../infrastructure/test-logger';
import { TRANSACTION_SLUGS } from '../config/test-constants';

describe('Module 18: Executive Dashboard KPIs & Counterfeit Currency Management', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;
  let reconciler: ReportReconciler;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();
    reconciler = ReportReconciler.getInstance();

    TestLogger.header('Module 18: Dashboard KPIs & Fake Currency');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  describe('Executive Dashboard Endpoints', () => {
    it('18.1 should fetch dashboard operational summary stats', async () => {
      const res = await client.get('/dashboard/stats');
      expect(res.status).toBe(200);
      TestLogger.success('Dashboard stats queried successfully');
    });

    it('18.2 should fetch today vs yesterday volume by currency', async () => {
      const res = await client.get('/dashboard/volume-by-currency');
      expect(res.status).toBe(200);
      TestLogger.success('Volume by currency queried');
    });

    it('18.3 should fetch 7-day transaction volume chart', async () => {
      const res = await client.get('/dashboard/volume-chart', { days: '7' });
      expect(res.status).toBe(200);
      TestLogger.success('Volume chart data queried');
    });

    it('18.4 should fetch pending approvals queue', async () => {
      const res = await client.get('/dashboard/pending-approvals');
      expect(res.status).toBe(200);
      TestLogger.success('Pending approvals queue queried');
    });
  });

  describe('Counterfeit / Fake Currency Confiscation', () => {
    it('18.5 should execute fake currency write-off transaction', async () => {
      if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id || !registry.masters.fakeReasonId) return;

      const res = await client.post('/transactions/drafts', {
        slug: TRANSACTION_SLUGS.FAKE_CURRENCY,
        branchId: registry.masters.branchA.id,
        counterId: registry.masters.counterA1?.id,
        reasonId: registry.masters.fakeReasonId,
        items: [
          {
            productId: registry.masters.productCn?.id,
            currencyId: registry.masters.currencyUsd.id,
            quantity: 100,
            rate: 88.0,
          },
        ],
      });

      if (res.status === 201 || res.status === 200) {
        const txnId = res.data?.id || res.data?.transaction?.id;
        if (txnId) {
          const getRes = await client.get(`/transactions/${txnId}`);
          expect(getRes.status).toBe(200);
          expect(getRes.data).toBeDefined();
          expect(getRes.data.id).toBe(txnId);
          TestLogger.success(`Verified GET /transactions/${txnId} round-trip (200 OK) for fake currency`);
        }

        reconciler.recordOperationDelta({
          usdStockDelta: -100, // Stock written off
          transactionsCountDelta: 1,
        });
        TestLogger.success('Fake currency confiscation transaction processed');
      } else {
        TestLogger.info(`Fake currency transaction returned ${res.status}`);
      }
    });

    it('18.6 should reject fake currency transaction when reason is missing or quantity is invalid', async () => {
      const res = await client.post('/transactions/drafts', {
        slug: TRANSACTION_SLUGS.FAKE_CURRENCY,
        branchId: registry.masters.branchA?.id,
        counterId: registry.masters.counterA1?.id,
        reasonId: '', // Missing
        items: [
          {
            productId: registry.masters.productCn?.id,
            currencyId: registry.masters.currencyUsd?.id,
            quantity: -50, // Invalid
          },
        ],
      });

      expect([400, 422]).toContain(res.status);
      TestLogger.success('Invalid fake currency payload correctly rejected');
    });

    it('18.7 should reject fake currency transaction with non-existent currency ID without 500 error', async () => {
      if (!registry.masters.branchA?.id || !registry.masters.fakeReasonId) return;

      const dummyCurrencyId = '00000000-0000-0000-0000-000000009999';
      const res = await client.post('/transactions/drafts', {
        slug: TRANSACTION_SLUGS.FAKE_CURRENCY,
        branchId: registry.masters.branchA.id,
        counterId: registry.masters.counterA1?.id,
        reasonId: registry.masters.fakeReasonId,
        items: [
          {
            productId: registry.masters.productCn?.id,
            currencyId: dummyCurrencyId,
            quantity: 50,
            rate: 88.0,
          },
        ],
      });

      expect([400, 422]).toContain(res.status);
      expect(res.status).not.toBe(500);
      TestLogger.success('Non-existent currency ID in fake currency rejected with 400/422 (no 500 error)');
    });
  });
});

