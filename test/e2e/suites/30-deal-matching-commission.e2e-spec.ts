import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';

describe('Module 30: Deal Cover Matching & Agent Commission', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 30: Deal Matching & Commission');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('30.1 should list deal covers with pagination and verify round-trip re-opening', async () => {
    const res = await client.get('/deal-covers', { limit: 10 });
    expect([200, 304]).toContain(res.status);
    expect(res.data).toBeDefined();

    const items = Array.isArray(res.data?.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []);
    if (items.length > 0) {
      const coverId = items[0].id;
      const getRes = await client.get(`/deal-covers/${coverId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.data).toBeDefined();
      expect(getRes.data.id).toBe(coverId);
      TestLogger.success(`Verified GET /deal-covers/${coverId} round-trip (200 OK)`);
    }

    TestLogger.success('Deal covers list retrieved successfully');
  });

  it('30.2 should list deal covers for acknowledgement endpoint', async () => {
    const res = await client.get('/deal-covers/ack', { limit: 10 });
    expect([200, 304]).toContain(res.status);
    TestLogger.success('Deal covers for acknowledgement retrieved');
  });

  it('30.3 should validate deal cover creation rejects missing bank account profile', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.productTt?.id || !registry.masters.cardIssuerPartyId) return;

    const policyRes = await client.get(`/auth/policy-context?branchId=${registry.masters.branchA.id}`);
    const txDate = policyRes.data?.transactionDate || new Date().toISOString().slice(0, 10);

    const res = await client.post('/deal-covers', {
      branchId: registry.masters.branchA.id,
      transactionDate: txDate,
      productId: registry.masters.productTt.id,
      partyProfileType: 'AGENT',
      partyProfileId: registry.masters.cardIssuerPartyId,
      // bankAccountProfileId omitted
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Deal cover creation without bank account correctly rejected');
  });

  it('30.4 should reject deal cover creation with non-existent branch ID without 500 error', async () => {
    const dummyBranchId = '00000000-0000-0000-0000-000000009999';
    const res = await client.post('/deal-covers', {
      branchId: dummyBranchId,
      productId: registry.masters.productTt?.id,
      feAmount: 1000,
      dealRate: 88.0,
      bookingRate: 88.0,
    });
    expect([400, 404, 422]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Non-existent branch ID in deal cover creation rejected with 400/404 (no 500 error)');
  });

  it('30.5 should return 404 for non-existent deal cover ID without 500 server error', async () => {
    const dummyCoverId = '00000000-0000-0000-0000-000000009999';
    const res = await client.get(`/deal-covers/${dummyCoverId}`);
    expect([404, 400]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Non-existent deal cover returned 404 (no 500 error)');
  });
});

