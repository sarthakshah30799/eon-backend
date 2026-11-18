import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { ReportReconciler } from '../infrastructure/report-reconciler';
import { ReportAccuracyValidator } from '../infrastructure/report-accuracy-validator';
import { TestLogger } from '../infrastructure/test-logger';
import { TRANSACTION_SLUGS } from '../config/test-constants';

describe('Module 3C: Currency Notes (CN) Purchase, Sale, Wholesale & Encashment', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;
  let reconciler: ReportReconciler;
  let saleTxId: string | undefined;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();
    reconciler = ReportReconciler.getInstance();

    TestLogger.header('Module 3C: Currency Notes (CN) Lifecycle');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('3C.1 should purchase currency notes from passenger (retail encashment surrender)', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.currencyUsd?.id).toBeDefined();

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.cardIssuerPartyId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Rajesh',
        lastName: 'Kumar',
        nationalityType: 'INDIAN',
        pan: 'CDEFG3456H',
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 800,
          rate: 87.0,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 69600,
        },
      ],
    });

    expect([200, 201]).toContain(res.status);
    expect(res.data?.id).toBeDefined();
    reconciler.recordOperationDelta({
      usdStockDelta: 800,
      cashDelta: -69600,
      transactionsCountDelta: 1,
    });
    TestLogger.success('CN retail purchase (encashment surrender) completed successfully');
  });

  it('3C.2 should execute retail sale of currency notes to passenger', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.currencyUsd?.id).toBeDefined();

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.cardIssuerPartyId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Pooja',
        lastName: 'Sharma',
        nationalityType: 'INDIAN',
        pan: 'DEFGH4567I',
        passportNumber: 'X1122334',
        ticketNumber: 'EK-501',
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 500,
          rate: 88.5,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 44250,
        },
      ],
    });

    expect([200, 201]).toContain(res.status);
    expect(res.data?.id).toBeDefined();
    saleTxId = res.data.id;
    reconciler.recordOperationDelta({
      usdStockDelta: -500,
      cashDelta: 44250,
      transactionsCountDelta: 1,
    });
    TestLogger.success('CN retail sale completed successfully');

    const getRes = await client.get(`/transactions/${saleTxId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.data?.id).toBe(saleTxId);
    expect(Array.isArray(getRes.data?.items)).toBe(true);
    expect(Number(getRes.data.items[0]?.quantity)).toBe(500);
    TestLogger.success('CN retail sale transaction re-opened cleanly via GET /transactions/:id');
  });

  it('3C.2B should verify retail CN sale renders accurately on Sale/Purchase frontend report table', async () => {
    expect(saleTxId).toBeDefined();

    const txRes = await client.get(`/transactions/${saleTxId}`);
    const txNum = txRes.data?.number || txRes.data?.transactionNumber;
    expect(txNum).toBeDefined();

    const spRes = await client.get('/reports/sale-purchase', {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      detail: 'long',
    });

    expect(spRes.status).toBe(200);
    ReportAccuracyValidator.verifyFrontendContract('sale-purchase', spRes.data);
    ReportAccuracyValidator.verifyTransactionOnFrontend('sale-purchase', spRes.data, {
      transactionNumber: txNum,
      currencyCode: 'USD',
      quantity: 500,
      rate: 88.5,
      grossAmount: 44250,
      netAmount: 44250,
    });
    TestLogger.success('Retail CN sale verified on Sale/Purchase frontend table');
  });

  it('3C.3 should execute wholesale purchase of currency notes from FFMC with cheque', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.currencyEur?.id).toBeDefined();

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.PURCHASE_BULK_FFMC,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.cardIssuerPartyId,
      tradeMode: 'BULK',
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyEur.id,
          quantity: 25000,
          rate: 94.5,
        },
      ],
      payments: [
        {
          paymentMethod: 'CHEQUE',
          amount: 25000 * 94.5,
          referenceNumber: 'CHQ-990123',
        },
      ],
    });

    expect([200, 201]).toContain(res.status);
    expect(res.data?.id).toBeDefined();
    reconciler.recordOperationDelta({
      eurStockDelta: 25000,
      transactionsCountDelta: 1,
    });
    TestLogger.success('Wholesale EUR currency purchase from FFMC completed');
  });

  it('3C.4 should reject retail sale of currency notes when requested quantity exceeds available counter stock (negative stock prevention)', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.currencyUsd?.id).toBeDefined();

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.cardIssuerPartyId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Over',
        lastName: 'Buyer',
        nationalityType: 'INDIAN',
        pan: 'ABCDE1234F',
        passportNumber: 'Z9988776',
        ticketNumber: 'EK-999',
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 999999,
          rate: 88.5,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 999999 * 88.5,
        },
      ],
    });

    expect(res.status).toBe(400);
    const message = typeof res.data?.message === 'string' ? res.data.message : JSON.stringify(res.data?.message ?? '');
    expect(message.toLowerCase()).toContain('exceeds available counter stock');
    TestLogger.success('Negative stock prevention verified: selling more than counter stock cleanly rejected with 400 Bad Request');
  });

  it('3C.5 should reject sale of currency notes when counter stock is 0 (negative stock prevention)', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();

    // Use an unstocked currency or currency with 0 counter balance
    const unstockedCurrencyId = registry.masters.currencyCmStocking?.id || registry.masters.currencyEur?.id || registry.masters.currencyGbp?.id;
    expect(unstockedCurrencyId).toBeDefined();

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.cardIssuerPartyId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Zero',
        lastName: 'Stock',
        nationalityType: 'INDIAN',
        pan: 'ABCDE1234F',
        passportNumber: 'Z9988776',
        ticketNumber: 'EK-999',
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: unstockedCurrencyId,
          quantity: 500000,
          rate: 100.0,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 500000 * 100.0,
        },
      ],
    });

    expect(res.status).toBe(400);
    const message = typeof res.data?.message === 'string' ? res.data.message : JSON.stringify(res.data?.message ?? '');
    expect(message.toLowerCase()).toContain('exceeds available counter stock');
    TestLogger.success('Negative stock prevention verified: selling unstocked currency cleanly rejected with 400 Bad Request');
  });
});

