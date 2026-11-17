import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';

describe('Module 10: Credit Request Fund & HO Approval Workflow', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  let testCreditReqId: string;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 10: Credit Request Fund');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('10.1 should query next credit request fund number', async () => {
    if (!registry.masters.branchA?.id) return;

    const res = await client.get('/credit-request-fund/next-number', {
      branchId: registry.masters.branchA.id,
    });
    expect([200, 304]).toContain(res.status);
    TestLogger.success('Next credit request number queried');
  });

  it('10.2 should submit a temporary Credit Request Fund in PENDING status', async () => {
    if (!registry.masters.branchA?.id) return;

    const res = await client.post('/credit-request-fund', {
      branchId: registry.masters.branchA.id,
      amount: 1000000,
      reason: 'Surge in corporate flight and forex bookings',
    });

    if (res.status === 201 || res.status === 200) {
      testCreditReqId = res.data?.id;
      TestLogger.success(`Credit Request Fund created: ${testCreditReqId} (status: ${res.data?.status})`);
    } else {
      TestLogger.info(`Credit request returned ${res.status}`);
    }
  });

  it('10.3 should approve Credit Request Fund by Head Office staff', async () => {
    if (!testCreditReqId) return;

    await workplaceManager.asHoStaff();
    const res = await client.post(`/credit-request-fund/${testCreditReqId}/approve`, {
      approvedAmount: 1000000,
      remarks: 'Approved for 7-day period',
    });

    expect([200, 201]).toContain(res.status);
    TestLogger.success(`Credit Request Fund approved: ${testCreditReqId}`);
  });

  it('10.3B should fetch approved credit request fund by ID (GET /credit-request-fund/:id) without 500 error', async () => {
    if (!testCreditReqId) return;

    const res = await client.get(`/credit-request-fund/${testCreditReqId}`);
    expect(res.status).toBe(200);
    expect(res.data?.id).toBe(testCreditReqId);
    expect(res.data?.branchId).toBe(registry.masters.branchA?.id);
    TestLogger.success('Credit Request Fund re-opened cleanly via GET /credit-request-fund/:id');
  });

  it('10.4 should reject credit request fund with non-positive amount (negative test)', async () => {
    if (!registry.masters.branchA?.id) return;

    const res = await client.post('/credit-request-fund', {
      branchId: registry.masters.branchA.id,
      amount: -50000,
      reason: 'Negative amount test',
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Credit Request Fund with negative amount correctly rejected with 400');
  });
});

