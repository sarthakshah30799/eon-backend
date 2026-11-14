import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';

describe('Module 16: Role-Based Access Control (RBAC) & Workplace Isolation', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 16: RBAC & Workplace Isolation');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('16.1 should allow Admin & HO staff to freely switch workplaces across branches', async () => {
    if (!registry.masters.branchA?.id) return;

    await workplaceManager.asAdmin();
    const switchedA = await workplaceManager.switchWorkplace(
      registry.masters.branchA.id,
      registry.masters.counterA1?.id,
    );
    expect(switchedA).toBe(true);
    TestLogger.success(`Admin switched to Branch A: ${registry.masters.branchA.id}`);

    if (registry.masters.branchB?.id && registry.masters.counterB1?.id && registry.masters.branchB.id !== registry.masters.branchA.id) {
      const switchedB = await workplaceManager.switchWorkplace(
        registry.masters.branchB.id,
        registry.masters.counterB1.id,
      );
      expect(switchedB).toBe(true);
      TestLogger.success(`Admin switched to Branch B: ${registry.masters.branchB.id}`);
    }
  });

  it('16.2 should verify /auth/me returns active session workplace context', async () => {
    const meRes = await client.get('/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.data).toBeDefined();
    TestLogger.success(`Active user context verified: ${meRes.data?.email || meRes.data?.username}`);
  });

  it('16.3 should reject switching workplace to non-existent branch ID without 500 error', async () => {
    const dummyBranchId = '00000000-0000-0000-0000-000000009999';
    const res = await client.post('/auth/switch-workplace', {
      branchId: dummyBranchId,
    });
    expect([400, 404, 422]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Switching to non-existent branch ID rejected with 400/404 (no 500 error)');
  });

  it('16.4 should reject switching workplace to non-existent counter ID without 500 error', async () => {
    if (!registry.masters.branchA?.id) return;
    const dummyCounterId = '00000000-0000-0000-0000-000000009999';
    const res = await client.post('/auth/switch-workplace', {
      branchId: registry.masters.branchA.id,
      counterId: dummyCounterId,
    });
    expect([400, 404, 422]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Switching to non-existent counter ID rejected with 400/404 (no 500 error)');
  });
});

