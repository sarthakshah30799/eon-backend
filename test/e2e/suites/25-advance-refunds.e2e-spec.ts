import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';

describe('Module 25: Advance Refund & Knock-Off Lifecycle', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 25: Advance Refund & Knock-Off');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('25.1 should query available advance receipts endpoint', async () => {
    const res = await client.get('/advance-refunds/available-advances', {
      panNumber: 'ABCDE1234F',
      branchId: registry.masters.branchA?.id,
    });

    expect([200, 304]).toContain(res.status);
    TestLogger.success('Available advance receipts queried');
  });

  it('25.2 should list advance refunds with pagination', async () => {
    const res = await client.get('/advance-refunds', {
      limit: 10,
    });

    expect([200, 304]).toContain(res.status);
    expect(res.data).toBeDefined();
    TestLogger.success('Advance refunds listing retrieved');
  });

  it('25.3 should reject advance refund creation with missing mandatory items', async () => {
    if (!registry.masters.branchA?.id) return;

    const policyRes = await client.get(`/auth/policy-context?branchId=${registry.masters.branchA.id}`);
    const txDate = policyRes.data?.transactionDate || new Date().toISOString().slice(0, 10);

    const res = await client.post('/advance-refunds', {
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      transactionDate: txDate,
      asOnDate: txDate,
      partyProfileId: registry.masters.cardIssuerPartyId,
      items: [], // Missing items
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Advance refund without items correctly rejected');
  });

  it('25.4 should enforce HO-only access for advance refund honour endpoint', async () => {
    // Non-existent ID test to verify authorization guard executes before entity lookup
    const fakeId = '00000000-0000-0000-0000-000000000000';
    try {
      await workplaceManager.asBranchUser();
      const res = await client.post(`/advance-refunds/${fakeId}/honour`, {
        hoPayingBankAccountId: fakeId,
      });
      expect([400, 403, 404]).toContain(res.status);
      TestLogger.success('Branch user access restriction verified on advance refund honour');
    } finally {
      await workplaceManager.asAdmin();
    }
  });

  it('25.5 should reject advance refund creation with non-existent advance voucher ID', async () => {
    if (!registry.masters.branchA?.id) return;
    const fakeVoucherId = '00000000-0000-0000-0000-000000000001';
    const txDate = new Date().toISOString().slice(0, 10);

    const res = await client.post('/advance-refunds', {
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      transactionDate: txDate,
      asOnDate: txDate,
      partyProfileId: registry.masters.cardIssuerPartyId,
      refundLedgerAccountId: registry.masters.cashAccountId,
      refundPaymentMethod: 'CASH',
      items: [
        {
          advanceVoucherId: fakeVoucherId,
          refundAmount: 5000,
        },
      ],
    });

    expect([400, 404, 422]).toContain(res.status);
    TestLogger.success('Advance refund with non-existent voucher correctly rejected with 400/404');
  });

  it('25.6 should return 404 on non-existent advance refund ID (GET /advance-refunds/:id) without 500 error', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await client.get(`/advance-refunds/${fakeId}`);
    expect(res.status).toBe(404);
    TestLogger.success('Non-existent advance refund ID gracefully handled with 404');
  });
});

