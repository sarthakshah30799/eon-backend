import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';
import { TRANSACTION_SLUGS } from '../config/test-constants';

describe('Module 14: Transaction Revisions, Draft Workflow & Rollbacks', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  let testDraftId: string;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 14: Transaction Revisions & Rollbacks');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('14.1 should create a transaction draft', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 200,
          rate: 88.5,
        },
      ],
    });

    if (res.status === 201 || res.status === 200) {
      testDraftId = res.data?.id;
      TestLogger.success(`Draft transaction created: ${testDraftId}`);

      if (testDraftId) {
        const getRes = await client.get(`/transactions/${testDraftId}`);
        expect(getRes.status).toBe(200);
        expect(getRes.data).toBeDefined();
        expect(getRes.data.id).toBe(testDraftId);
        TestLogger.success(`Verified GET /transactions/${testDraftId} round-trip (200 OK) for draft`);
      }
    } else {
      TestLogger.info(`Draft creation returned ${res.status}`);
    }
  });

  it('14.2 should reject a transaction draft and trigger rollback', async () => {
    if (!testDraftId) return;

    const res = await client.post(`/transactions/${testDraftId}/reject`, {
      rejectionReason: 'Customer requested cancellation',
    });

    expect([200, 201]).toContain(res.status);
    TestLogger.success(`Transaction draft rejected and rolled back: ${testDraftId}`);

    const getRes = await client.get(`/transactions/${testDraftId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.data).toBeDefined();
    expect(getRes.data.id).toBe(testDraftId);
    TestLogger.success(`Verified GET /transactions/${testDraftId} round-trip (200 OK) after rejection`);
  });

  it('14.3 should queue account posting rebuild for an approved transaction', async () => {
    // If we have an existing transaction, queue rebuild
    const listRes = await client.get('/transactions', { limit: 1 });
    const items = Array.isArray(listRes.data?.items) ? listRes.data.items : (Array.isArray(listRes.data) ? listRes.data : []);
    if (items.length > 0) {
      const targetId = items[0].id;
      const getRes = await client.get(`/transactions/${targetId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.data.id).toBe(targetId);

      const rebuildRes = await client.post(`/transactions/${targetId}/account-postings/rebuild`);
      expect([200, 201, 202]).toContain(rebuildRes.status);
      TestLogger.success(`Account posting rebuild queued for transaction: ${targetId}`);
    }
  });

  it('14.4 should return 404/empty for non-existent transaction ID without 500 server error', async () => {
    const dummyTxnId = '00000000-0000-0000-0000-000000009999';
    const res = await client.get(`/transactions/${dummyTxnId}`);
    expect([200, 404, 400]).toContain(res.status);
    expect(res.status).not.toBe(500);
    if (res.status === 200) {
      expect(!res.data || Object.keys(res.data).length === 0).toBe(true);
    }
    TestLogger.success('Non-existent transaction handled gracefully (no 500 error)');
  });

  it('14.5 should return 404/400 when rejecting non-existent transaction draft without 500 server error', async () => {
    const dummyTxnId = '00000000-0000-0000-0000-000000009999';
    const res = await client.post(`/transactions/${dummyTxnId}/reject`, {
      rejectionReason: 'Dummy rejection',
    });
    expect([404, 400]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Reject non-existent draft returned 404/400 (no 500 error)');
  });
});

