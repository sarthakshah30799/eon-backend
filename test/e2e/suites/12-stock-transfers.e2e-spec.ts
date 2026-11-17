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
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.branchB?.id).toBeDefined();
    expect(registry.masters.currencyEur?.id).toBeDefined();

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

    expect([200, 201]).toContain(res.status);
    expect(res.data?.id).toBeDefined();
    testTransferId = res.data.id;
    TestLogger.success(`Branch transfer created: ${testTransferId} (status: ${res.data?.status})`);
  });

  it('7.3 should accept pending branch transfer by destination branch', async () => {
    expect(testTransferId).toBeDefined();

    const res = await client.post(`/transfers/${testTransferId}/accept`);
    expect([200, 201]).toContain(res.status);
    TestLogger.success(`Branch transfer accepted: ${testTransferId}`);
  });

  it('7.3B should fetch transfer by ID (GET /transfers/:id) and verify status and transfer items without 500 error', async () => {
    expect(testTransferId).toBeDefined();

    const res = await client.get(`/transfers/${testTransferId}`);
    expect(res.status).toBe(200);
    expect(res.data?.id).toBe(testTransferId);
    expect(Array.isArray(res.data?.items)).toBe(true);
    expect(res.data.items.length).toBeGreaterThan(0);
    TestLogger.success(`Transfer re-opened cleanly via GET /transfers/:id without 500 errors`);
  });

  it('7.4 should generate transfer voucher print', async () => {
    expect(testTransferId).toBeDefined();

    const res = await client.post(`/transfers/${testTransferId}/print`);
    expect([200, 201]).toContain(res.status);
    TestLogger.success('Transfer print generated');
  });

  it('7.5 should reject branch transfer with non-existent destination branch ID (negative test)', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.currencyEur?.id).toBeDefined();
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

  it('7.6 should reject branch transfer when requested quantity exceeds available counter stock (negative stock prevention)', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.branchB?.id).toBeDefined();
    expect(registry.masters.counterB1?.id).toBeDefined();
    expect(registry.masters.currencyUsd?.id).toBeDefined();

    const res = await client.post('/transfers/branch', {
      sourceBranchId: registry.masters.branchA.id,
      sourceCounterId: registry.masters.counterA1?.id,
      destinationBranchId: registry.masters.branchB.id,
      destinationCounterId: registry.masters.counterB1.id,
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 99999999,
          per: 1,
          rate: 85.0,
        },
      ],
      remarks: 'Attempting excessive transfer exceeding counter stock',
    });

    expect(res.status).toBe(400);
    const message = typeof res.data?.message === 'string' ? res.data.message : JSON.stringify(res.data?.message ?? '');
    expect(message.toLowerCase()).toContain('exceeds available counter stock');
    TestLogger.success('Negative stock prevention on transfers verified: transfer exceeding counter stock cleanly rejected with 400 Bad Request');
  });

  it('7.7 should reject counter transfer when requested quantity exceeds available counter stock', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.counterA1?.id).toBeDefined();
    const testCurrency = registry.masters.currencyCmStocking?.id || registry.masters.currencyEur?.id || registry.masters.currencyGbp?.id || registry.masters.currencyUsd?.id;
    expect(testCurrency).toBeDefined();

    const destCounterId = registry.masters.counterA2?.id && registry.masters.counterA2.id !== registry.masters.counterA1.id
      ? registry.masters.counterA2.id
      : registry.masters.counterB1?.id;
    expect(destCounterId).toBeDefined();
    expect(destCounterId).not.toBe(registry.masters.counterA1.id);

    const res = await client.post('/transfers/counter', {
      sourceBranchId: registry.masters.branchA.id,
      sourceCounterId: registry.masters.counterA1.id,
      destinationBranchId: registry.masters.branchA.id,
      destinationCounterId: destCounterId,
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: testCurrency,
          quantity: 5000000,
          per: 1,
          rate: 100.0,
        },
      ],
      remarks: 'Counter transfer exceeding stock',
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Counter transfer stock enforcement verified: rejected with 400 Bad Request');
  });
});

