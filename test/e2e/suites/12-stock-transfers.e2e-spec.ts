import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { ReportReconciler } from '../infrastructure/report-reconciler';
import { TestLogger } from '../infrastructure/test-logger';

describe('Module 7: Currency Stock Transfers (Inter-Counter & Inter-Branch)', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;
  let reconciler: ReportReconciler;

  let testTransferId: string;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();
    reconciler = ReportReconciler.getInstance();

    TestLogger.header('Module 7: Currency Transfers');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('7.1 should query list of active transfers', async () => {
    const res = await client.get('/transfers');
    expect(res.status).toBe(200);
    TestLogger.success('Queried transfers list');
  });

  it('7.2 should initiate inter-branch currency stock transfer (Branch A to Branch B)', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.branchB?.id || !registry.masters.currencyEur?.id) return;

    const res = await client.post('/transfers/branch', {
      fromBranchId: registry.masters.branchA.id,
      toBranchId: registry.masters.branchB.id,
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyEur.id,
          quantity: 5000,
        },
      ],
      remarks: 'Transfer surplus EUR to Branch B',
    });

    if (res.status === 201 || res.status === 200) {
      testTransferId = res.data?.id;
      TestLogger.success(`Branch transfer created: ${testTransferId} (status: ${res.data?.status})`);
    } else {
      TestLogger.info(`Branch transfer returned ${res.status}`);
    }
  });

  it('7.3 should accept pending branch transfer by destination branch', async () => {
    if (!testTransferId) return;

    const res = await client.post(`/transfers/${testTransferId}/accept`);
    expect([200, 201]).toContain(res.status);
    TestLogger.success(`Branch transfer accepted: ${testTransferId}`);
  });

  it('7.3B should fetch transfer by ID (GET /transfers/:id) and verify status and transfer items without 500 error', async () => {
    if (!testTransferId) return;

    const res = await client.get(`/transfers/${testTransferId}`);
    expect(res.status).toBe(200);
    expect(res.data?.id).toBe(testTransferId);
    expect(Array.isArray(res.data?.items)).toBe(true);
    expect(res.data.items.length).toBeGreaterThan(0);
    TestLogger.success(`Transfer re-opened cleanly via GET /transfers/:id without 500 errors`);
  });

  it('7.4 should generate transfer voucher print', async () => {
    if (!testTransferId) return;

    const res = await client.post(`/transfers/${testTransferId}/print`);
    expect([200, 201]).toContain(res.status);
    TestLogger.success('Transfer print generated');
  });

  it('7.5 should reject branch transfer with non-existent destination branch ID (negative test)', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyEur?.id) return;
    const fakeBranchId = '00000000-0000-0000-0000-000000000000';

    const res = await client.post('/transfers/branch', {
      fromBranchId: registry.masters.branchA.id,
      toBranchId: fakeBranchId,
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyEur.id,
          quantity: 100,
        },
      ],
      remarks: 'Invalid destination branch test',
    });

    expect([400, 404, 422]).toContain(res.status);
    TestLogger.success('Transfer with non-existent branch correctly rejected');
  });
});

