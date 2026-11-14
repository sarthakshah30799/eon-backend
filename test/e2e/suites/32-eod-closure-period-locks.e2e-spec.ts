import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';
import { TRANSACTION_SLUGS } from '../config/test-constants';

describe('Module 32: EOD Operational Closure & Period Locking', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 32: EOD & Period Locking');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('32.1 should query branch policy context and active transaction date', async () => {
    if (!registry.masters.branchA?.id) return;

    const res = await client.get('/auth/policy-context', {
      branchId: registry.masters.branchA.id,
    });

    expect([200, 304]).toContain(res.status);
    expect(res.data?.transactionDate).toBeDefined();
    TestLogger.success(`Active policy transaction date: ${res.data?.transactionDate}`);
  });

  it('32.2 should query active monthly locks listing', async () => {
    const res = await client.get('/monthly-locks');
    expect([200, 304]).toContain(res.status);
    expect(Array.isArray(res.data)).toBe(true);
    TestLogger.success('Monthly lock periods listed');
  });

  it('32.3 should enforce admin/HO guard on creating monthly lock windows', async () => {
    try {
      await workplaceManager.asBranchUser();
      const res = await client.post('/monthly-locks', {
        branchId: registry.masters.branchA?.id,
        year: 2026,
        month: 10,
      });
      expect([400, 403]).toContain(res.status);
      TestLogger.success('Branch user prevented from altering monthly lock rules');
    } finally {
      await workplaceManager.asAdmin();
    }
  });

  it('32.4 should strictly reject backdated transactions outside locked windows', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      transactionDate: '2023-01-01', // Locked historical date
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 100,
          rate: 88.0,
        },
      ],
    });

    expect([400, 403, 422]).toContain(res.status);
    TestLogger.success('Locked month backdated transaction blocked');
  });

  it('32.5 should reject monthly lock with invalid month number without 500 error', async () => {
    if (!registry.masters.branchA?.id) return;

    const res = await client.post('/monthly-locks', {
      branchId: registry.masters.branchA.id,
      year: 2026,
      month: 99, // Invalid month
    });

    expect([400, 422]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Invalid month number in monthly-locks rejected with 400/422 (no 500 error)');
  });

  it('32.6 should handle policy context with non-existent branch ID safely without 500 error', async () => {
    const dummyBranchId = '00000000-0000-0000-0000-000000009999';
    const res = await client.get('/auth/policy-context', {
      branchId: dummyBranchId,
    });

    expect([200, 400, 404, 422]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Policy context with non-existent branch ID handled safely (no 500 error)');
  });
});

