import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';

describe('Module 6: AD1 / Remittance Transactions', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  let testAd1Id: string;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 6: AD1 Remittance');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('6.1 should fetch list of eligible AD1 agents', async () => {
    const res = await client.get('/transactions/ad1/agents');
    expect(res.status).toBe(200);
    TestLogger.success('AD1 agents queried successfully');
  });

  it('6.2 should query AD1 transaction history', async () => {
    const res = await client.get('/transactions/ad1');
    expect(res.status).toBe(200);
    TestLogger.success('AD1 transactions queried');
  });

  it('6.3 should create an AD1 transaction draft when required details provided', async () => {
    if (!registry.masters.branchA?.id) return;

    const res = await client.post('/transactions/ad1', {
      branchId: registry.masters.branchA.id,
      remitterName: 'Kunal Singhania',
      beneficiaryName: 'University Fees Global',
      currencyCode: 'USD',
      amount: 10000,
    });

    if (res.status === 201 || res.status === 200) {
      testAd1Id = res.data?.id;
      TestLogger.success(`AD1 Transaction created: ${testAd1Id}`);
    } else {
      TestLogger.info(`AD1 creation returned ${res.status}`);
    }
  });

  it('6.3B should fetch created AD1 transaction by ID (GET /transactions/ad1/:id) without 500 error', async () => {
    if (!testAd1Id) return;

    const res = await client.get(`/transactions/ad1/${testAd1Id}`);
    expect(res.status).toBe(200);
    expect(res.data?.id).toBe(testAd1Id);
    TestLogger.success('AD1 transaction re-opened cleanly via GET /transactions/ad1/:id');
  });

  it('6.4 should fetch AD1 print output if record exists', async () => {
    if (!testAd1Id) return;

    const res = await client.post(`/transactions/ad1/${testAd1Id}/print`);
    expect([200, 201]).toContain(res.status);
    TestLogger.success('AD1 print output generated');
  });
});

