import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';

describe('Module 27: Product Settlement Lifecycle & State Machine', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 27: Product Settlement Lifecycle');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('27.1 should query unsettled product items endpoint', async () => {
    if (!registry.masters.cardIssuerPartyId || !registry.masters.currencyUsd?.id) return;

    const res = await client.get('/product-settlements/unsettled', {
      kind: 'HO_ISSUER',
      issuerPartyProfileId: registry.masters.cardIssuerPartyId,
      currencyId: registry.masters.currencyUsd.id,
      hoBranchId: registry.masters.branchA?.id,
    });

    expect([200, 304]).toContain(res.status);
    TestLogger.success('Unsettled product items queried successfully');
  });

  it('27.2 should list product settlements with pagination', async () => {
    const res = await client.get('/product-settlements', {
      limit: 10,
    });

    expect([200, 304]).toContain(res.status);
    expect(res.data).toBeDefined();
    TestLogger.success('Product settlements listing retrieved');
  });

  it('27.3 should reject settlement creation when items array is empty', async () => {
    if (!registry.masters.cardIssuerPartyId || !registry.masters.currencyUsd?.id) return;

    const policyRes = await client.get(`/auth/policy-context?branchId=${registry.masters.branchA?.id}`);
    const txDate = policyRes.data?.transactionDate || new Date().toISOString().slice(0, 10);

    const res = await client.post('/product-settlements', {
      kind: 'HO_ISSUER',
      issuerPartyProfileId: registry.masters.cardIssuerPartyId,
      currencyId: registry.masters.currencyUsd.id,
      transactionDate: txDate,
      items: [], // Empty
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Settlement creation with empty items rejected');
  });

  it('27.4 should validate rejection reason is mandatory when rejecting settlement', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await client.post(`/product-settlements/${fakeId}/reject`, {
      reason: '', // Empty reason
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Rejection without mandatory reason correctly blocked');
  });

  it('27.5 should validate cancellation reason is mandatory when cancelling settlement', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await client.post(`/product-settlements/${fakeId}/cancel`, {
      reason: '', // Empty reason
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Cancellation without mandatory reason correctly blocked');
  });

  it('27.6 should return 404 on non-existent settlement ID (GET /product-settlements/:id) without 500 error', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await client.get(`/product-settlements/${fakeId}`);
    expect([404]).toContain(res.status);
    TestLogger.success('Non-existent settlement ID gracefully returned 404');
  });
});

