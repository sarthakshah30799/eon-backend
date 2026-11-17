import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';
import { TRANSACTION_SLUGS } from '../config/test-constants';

describe('Module 9: Advance Adjustment & HO Advance Refund Honour', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  let testOutstandingSaleId: string;
  let testAdjustmentId: string;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 9: Advance Adjustments & Refunds');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('9.1 should query outstanding sales eligible for advance adjustment', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.counterA1?.id).toBeDefined();
    expect(registry.masters.cardIssuerPartyId).toBeDefined();

    const res = await client.get('/advance-adjustments/outstanding-sales', {
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1.id,
      partyProfileId: registry.masters.cardIssuerPartyId,
      asOnDate: new Date().toISOString().slice(0, 10),
    });
    expect([200, 304]).toContain(res.status);
    TestLogger.success('Queried outstanding sales for advance adjustment');
  });

  it('9.2 should query available advances eligible for refund', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();

    const res = await client.get('/advance-refunds/available-advances', {
      branchId: registry.masters.branchA.id,
      panNumber: 'ABCDE1234F',
    });
    expect([200, 304]).toContain(res.status);
    TestLogger.success('Queried available advances for refund');
  });

  it('9.3 should query advance refund records list', async () => {
    const res = await client.get('/advance-refunds');
    expect(res.status).toBe(200);
    TestLogger.success('Queried advance refunds history');
  });

  it('9.4 should query advance adjustment records list (/advance-adjustments)', async () => {
    const res = await client.get('/advance-adjustments');
    expect(res.status).toBe(200);
    TestLogger.success('Queried advance adjustments history');
  });

  it('9.5 should create an advance adjustment adjusting an outstanding sale bill', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.counterA1?.id).toBeDefined();
    expect(registry.masters.corporatePartyProfile?.id).toBeDefined();

    // Step 1: Query outstanding sales for corporate client
    const salesRes = await client.get('/advance-adjustments/outstanding-sales', {
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1.id,
      partyProfileId: registry.masters.corporatePartyProfile.id,
      asOnDate: new Date().toISOString().slice(0, 10),
    });

    let sales = Array.isArray(salesRes.data)
      ? salesRes.data
      : (Array.isArray(salesRes.data?.data) ? salesRes.data.data : []);

    if (sales.length === 0 && registry.masters.productCn?.id && registry.masters.currencyUsd?.id) {
      const saleRes = await client.post('/transactions/drafts', {
        slug: TRANSACTION_SLUGS.SALE_CORPORATE_INDIVIDUAL,
        branchId: registry.masters.branchA.id,
        counterId: registry.masters.counterA1.id,
        tradeMode: 'BULK',
        partyProfileId: registry.masters.corporatePartyProfile.id,
        items: [
          {
            productId: registry.masters.productCn.id,
            currencyId: registry.masters.currencyUsd.id,
            quantity: 100,
            rate: 88.5,
          },
        ],
        payments: [
          {
            paymentMethod: 'CHEQUE',
            amount: 3850,
            referenceNumber: 'CHQ999111',
            referenceDate: new Date().toISOString().slice(0, 10),
            branchName: 'Fort',
            drawnOn: 'HDFC Bank',
          },
        ],
      });
      expect([200, 201]).toContain(saleRes.status);
      const recheckSales = await client.get('/advance-adjustments/outstanding-sales', {
        branchId: registry.masters.branchA.id,
        counterId: registry.masters.counterA1.id,
        partyProfileId: registry.masters.corporatePartyProfile.id,
        asOnDate: new Date().toISOString().slice(0, 10),
      });
      sales = Array.isArray(recheckSales.data)
        ? recheckSales.data
        : (Array.isArray(recheckSales.data?.data) ? recheckSales.data.data : []);
    }

    expect(sales.length).toBeGreaterThan(0);
    testOutstandingSaleId = sales[0].id;
    const adjAmount = Math.min(Number(sales[0].outstandingAmount || 5000), 5000).toFixed(2);

    const adjRes = await client.post('/advance-adjustments', {
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1.id,
      transactionDate: new Date().toISOString().slice(0, 10),
      asOnDate: new Date().toISOString().slice(0, 10),
      partyProfileId: registry.masters.corporatePartyProfile.id,
      narration: 'Advance adjustment against corporate client bill',
      items: [
        {
          transactionId: testOutstandingSaleId,
          adjustmentAmount: adjAmount,
        },
      ],
    });

    expect([200, 201]).toContain(adjRes.status);
    expect(adjRes.data?.id).toBeDefined();
    testAdjustmentId = adjRes.data.id;
    TestLogger.success(`Advance adjustment created: ${testAdjustmentId} (Adjusted: ${adjAmount})`);
  });

  it('9.6 should get advance adjustment details by ID', async () => {
    expect(testAdjustmentId).toBeDefined();

    const res = await client.get(`/advance-adjustments/${testAdjustmentId}`);
    expect([200, 304]).toContain(res.status);
    expect(res.data?.id).toBe(testAdjustmentId);
    TestLogger.success(`Retrieved advance adjustment details for: ${testAdjustmentId}`);
  });

  it('9.7 should return 404 for non-existent advance adjustment ID without 500 server error', async () => {
    const dummyId = '00000000-0000-0000-0000-000000009999';
    const res = await client.get(`/advance-adjustments/${dummyId}`);
    expect([404, 400]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Non-existent advance adjustment returned 404 (no 500 error)');
  });

  it('9.8 should reject advance adjustment with non-existent transaction ID without 500 error', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.corporatePartyProfile?.id).toBeDefined();

    const dummyTxnId = '00000000-0000-0000-0000-000000009999';
    const res = await client.post('/advance-adjustments', {
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.corporatePartyProfile.id,
      narration: 'Invalid adjustment test',
      items: [
        {
          transactionId: dummyTxnId,
          adjustmentAmount: 1000,
        },
      ],
    });
    expect([400, 404, 422]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Advance adjustment with non-existent transaction ID rejected with 400/404 (no 500 error)');
  });
});
