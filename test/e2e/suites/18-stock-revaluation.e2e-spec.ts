import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';

describe('Module 13: Stock Revaluation (Mark-to-Market Inventory & Gain/Loss)', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 13: Stock Revaluation');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('13.1 should download stock revaluation template', async () => {
    const res = await client.get('/stock-revaluations/template');
    expect([200, 304]).toContain(res.status);
    TestLogger.success('Stock revaluation template downloaded');
  });

  it('13.2 should query current holding stock for revaluation', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.counterA1?.id) return;

    const targets = JSON.stringify([
      {
        branchId: registry.masters.branchA.id,
        counterId: registry.masters.counterA1.id,
      },
    ]);

    const res = await client.get('/stock-revaluations/current', {
      frequency: 'MONTHLY',
      targets,
    });
    expect([200, 304]).toContain(res.status);
    TestLogger.success('Current holding stock for revaluation queried');
  });

  it('13.3 should reject querying stock revaluations with invalid frequency (400)', async () => {
    const targets = JSON.stringify([
      {
        branchId: registry.masters.branchA?.id || '00000000-0000-0000-0000-000000000000',
        counterId: registry.masters.counterA1?.id || '00000000-0000-0000-0000-000000000000',
      },
    ]);
    const res = await client.get('/stock-revaluations/current', {
      frequency: 'INVALID_FREQUENCY',
      targets,
    });
    expect(res.status).toBe(400);
    TestLogger.success('Invalid stock revaluation frequency rejected with 400');
  });

  it('13.4 should return 404 on non-existent stock revaluation ID (GET /stock-revaluations/:id) without 500 error', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await client.get(`/stock-revaluations/${fakeId}`);
    expect([404]).toContain(res.status);
    TestLogger.success('Non-existent stock revaluation ID gracefully returned 404');
  });
});

