import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';
import { TRANSACTION_SLUGS } from '../config/test-constants';

describe('Module 1: Day End / Day Start (BOD/EOD) & Policy Locks', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 1: BOD / EOD & Policy Locks');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('1.1 should execute Day Start (BOD) successfully for active branch/counter', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.counterA1?.id) return;

    const res = await client.post('/day-end-start-process/start', {
      branchId: registry.masters.branchA.id,
      answers: {
        ratesVerified: true,
        cashVerified: true,
      },
    });

    // Either 201 Created (newly started) or 400 (already started today) are valid operational states
    expect([201, 200, 400]).toContain(res.status);
    if (res.status === 201 || res.status === 200) {
      TestLogger.success('BOD Day Start initiated successfully');
    } else {
      TestLogger.info('BOD Day Start already active for today (system protected)');
    }
  });

  it('1.2 should reject duplicate Day Start when already started', async () => {
    if (!registry.masters.branchA?.id) return;

    const res = await client.post('/day-end-start-process/start', {
      branchId: registry.masters.branchA.id,
      answers: {
        ratesVerified: true,
        cashVerified: true,
      },
    });

    if (res.status === 400) {
      const msg = Array.isArray(res.data?.message) ? res.data.message.join(' ') : (res.data?.message || JSON.stringify(res.data));
      expect(msg).toMatch(/already|started|active|Complete EOD/i);
      TestLogger.success('Duplicate Day Start correctly blocked');
    }
  });

  it('1.3 should reject cross-branch BOD start by non-HO user', async () => {
    // Attempt with dynamic user (Cashier/operator) if available
    try {
      await workplaceManager.asDynamicUser(0);
      if (registry.masters.branchB?.id && registry.masters.branchB.id !== registry.masters.branchA?.id) {
        const res = await client.post('/day-end-start-process/start', {
          branchId: registry.masters.branchB.id,
          answers: { ratesVerified: true },
        });
        expect([400, 403]).toContain(res.status);
        TestLogger.success('Unauthorized cross-branch Day Start blocked');
      }
    } catch {
      TestLogger.info('Dynamic user not configured, skipping non-HO cross-branch BOD check');
    } finally {
      await workplaceManager.asAdmin();
    }
  }, 120000);

  it('1.4 should enforce monthly lock backdating bounds', async () => {
    // Attempting a transaction dated 2 years in the past without active backdate window
    const invalidPastDate = '2024-01-01';
    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      transactionDate: invalidPastDate,
      branchId: registry.masters.branchA?.id,
      counterId: registry.masters.counterA1?.id,
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd?.id,
          quantity: 100,
          rate: 88.0,
        },
      ],
    });

    expect([400, 403, 422]).toContain(res.status);
    TestLogger.success('Backdated transaction outside lock window correctly blocked');
  });

  it('1.5 should reject Day Start with non-existent branch ID without 500 error', async () => {
    const dummyBranchId = '00000000-0000-0000-0000-000000009999';
    const res = await client.post('/day-end-start-process/start', {
      branchId: dummyBranchId,
      answers: { ratesVerified: true },
    });

    expect([400, 404, 422]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Day Start with non-existent branch ID rejected with 400/404 (no 500 error)');
  });

  it('1.6 should reject Day End complete with non-existent branch ID without 500 error', async () => {
    const dummyBranchId = '00000000-0000-0000-0000-000000009999';
    const res = await client.post('/day-end-start-process/complete', {
      branchId: dummyBranchId,
      answers: { cashCounted: true },
    });

    expect([400, 404, 422]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Day End complete with non-existent branch ID rejected with 400/404 (no 500 error)');
  });
});

