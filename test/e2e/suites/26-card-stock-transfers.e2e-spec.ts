import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';

describe('Module 26: CARD Stock Inter-Branch Transfers', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 26: CARD Stock Inter-Branch Transfers');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('26.1 should query available CARD stock for transfer', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.productCc?.id || !registry.masters.cardIssuerPartyId) return;

    const res = await client.get('/card-stock/transfers/available-cards', {
      sourceBranchId: registry.masters.branchA.id,
      productId: registry.masters.productCc.id,
      issuerPartyProfileId: registry.masters.cardIssuerPartyId,
      currencyId: registry.masters.currencyUsd?.id,
    });

    expect([200, 304]).toContain(res.status);
    TestLogger.success('Available card stock for transfer queried successfully');
  });

  it('26.2 should list CARD transfer requests with pagination', async () => {
    const res = await client.get('/card-stock/transfers', {
      limit: 10,
    });

    expect([200, 304]).toContain(res.status);
    expect(res.data).toBeDefined();
    TestLogger.success('CARD transfers list retrieved');
  });

  it('26.3 should reject CARD transfer when source and destination branches are identical', async () => {
    if (!registry.masters.branchA?.id) return;

    const policyRes = await client.get(`/auth/policy-context?branchId=${registry.masters.branchA.id}`);
    const txDate = policyRes.data?.transactionDate || new Date().toISOString().slice(0, 10);

    const res = await client.post('/card-stock/transfers', {
      sourceBranchId: registry.masters.branchA.id,
      destinationBranchId: registry.masters.branchA.id, // Identical
      transactionDate: txDate,
      items: [],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Same-branch CARD transfer rejected');
  });

  it('26.4 should reject CARD transfer request with empty items array', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.branchB?.id) return;

    const policyRes = await client.get(`/auth/policy-context?branchId=${registry.masters.branchA.id}`);
    const txDate = policyRes.data?.transactionDate || new Date().toISOString().slice(0, 10);

    const res = await client.post('/card-stock/transfers', {
      sourceBranchId: registry.masters.branchA.id,
      destinationBranchId: registry.masters.branchB.id,
      transactionDate: txDate,
      items: [],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('CARD transfer with empty items correctly rejected');
  });

  it('26.5 should return 404 on non-existent card stock transfer ID (GET /card-stock/transfers/:id) without 500 error', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await client.get(`/card-stock/transfers/${fakeId}`);
    expect([404]).toContain(res.status);
    TestLogger.success('Non-existent card transfer ID cleanly returns 404 without 500 error');
  });

  it('26.6 should reject card transfer with non-existent card ID (negative test)', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.branchB?.id || !registry.masters.currencyUsd?.id || !registry.masters.productCc?.id) return;
    const fakeCardId = '00000000-0000-0000-0000-000000000001';
    const txDate = new Date().toISOString().slice(0, 10);

    const res = await client.post('/card-stock/transfers', {
      sourceBranchId: registry.masters.branchA.id,
      destinationBranchId: registry.masters.branchB.id,
      transactionDate: txDate,
      items: [
        {
          productId: registry.masters.productCc.id,
          currencyId: registry.masters.currencyUsd.id,
          cardIds: [fakeCardId],
        },
      ],
    });

    expect([400, 404, 422]).toContain(res.status);
    TestLogger.success('Card transfer with non-existent card ID correctly rejected');
  });
});

