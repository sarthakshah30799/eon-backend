import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { ReportReconciler } from '../infrastructure/report-reconciler';
import { TestLogger } from '../infrastructure/test-logger';
import { TRANSACTION_SLUGS } from '../config/test-constants';

describe('Module 3B: Multi-Currency Forex Card (CM) Full Lifecycle, Multi-Wallet & Settlement', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;
  let reconciler: ReportReconciler;

  let testCmKitNo: string;
  let testCmCardNo: string;
  let testCmCardId: string;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();
    reconciler = ReportReconciler.getInstance();

    TestLogger.header('Module 3B: Multi-Currency Card (CM) Lifecycle');
    await workplaceManager.asAdmin();
    await registry.initialize(client);

    const rand = Date.now().toString().slice(-6);
    testCmKitNo = `KIT_CM_${rand}`;
    testCmCardNo = `520033334444${rand.slice(0, 4)}`;
  });

  it('3B.1 should create CM multi-currency card stock receipt', async () => {
    const cmCurrencyId = registry.masters.currencyCmStocking?.id || registry.masters.currencyUsd?.id;
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.cardIssuerPartyId).toBeDefined();
    expect(cmCurrencyId).toBeDefined();

    const policyRes = await client.get(`/auth/policy-context?branchId=${registry.masters.branchA.id}`);
    const receiptDate = policyRes.data?.transactionDate || new Date().toISOString().slice(0, 10);

    const res = await client.post('/card-stock/receipts', {
      receiptDate,
      issuerPartyProfileId: registry.masters.cardIssuerPartyId,
      branchId: registry.masters.branchA.id,
      totalFeAmount: '1',
      items: [
        {
          lineNo: 1,
          currencyId: cmCurrencyId,
          per: '1',
          productId: registry.masters.productCm?.id,
          issuerPartyProfileId: registry.masters.cardIssuerPartyId,
          feAmount: '1',
          cards: [
            {
              series: 'CM',
              kitNumber: testCmKitNo,
              cardNumber: testCmCardNo,
              denomination: '1',
              amount: '1',
              expirationDate: '2030-12-31',
            },
          ],
        },
      ],
    });

    expect([201, 200]).toContain(res.status);
    TestLogger.success(`CM Card stock receipt created: ${testCmKitNo}`);

    const receiptId = res.data?.id;
    if (res.data?.items?.[0]?.cards?.[0]?.id) {
      testCmCardId = res.data.items[0].cards[0].id;
    }
    if (receiptId) {
      const getRes = await client.get(`/card-stock/receipts/${receiptId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.data).toBeDefined();
      expect(getRes.data.id).toBe(receiptId);
      if (getRes.data?.items?.[0]?.cards?.[0]?.id) {
        testCmCardId = getRes.data.items[0].cards[0].id;
      }
      TestLogger.success(`Verified GET /card-stock/receipts/${receiptId} round-trip (200 OK)`);
    }

    if (!testCmCardId) {
      const availRes = await client.get('/card-stock/receipts/cards/available', {
        branchId: registry.masters.branchA.id,
        productId: registry.masters.productCm?.id,
        issuerPartyProfileId: registry.masters.cardIssuerPartyId,
      });
      const cards = Array.isArray(availRes.data?.data) ? availRes.data.data : (Array.isArray(availRes.data) ? availRes.data : []);
      const matching = cards.find((c: any) => c.kitNumber === testCmKitNo) || cards[0];
      if (matching?.id) {
        testCmCardId = matching.id;
      }
    }
  });

  it('3B.2 should issue multi-currency sale with USD and EUR items on same card', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.currencyUsd?.id).toBeDefined();
    expect(registry.masters.currencyEur?.id).toBeDefined();
    expect(testCmCardId).toBeDefined();

    const txDate = registry.masters.transactionDate || new Date().toISOString().slice(0, 10);
    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      transactionDate: txDate,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.cardIssuerPartyId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Siddharth',
        lastName: 'Mehta',
        nationalityType: 'INDIAN',
        pan: 'BCDEF2345G',
        passportNumber: 'Y9876543',
      },
      items: [
        {
          productId: registry.masters.productCm?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 1000,
          rate: 88.5,
          cardKitNumber: testCmKitNo,
          cardNumber: testCmCardNo,
          cardId: testCmCardId,
          issuerPartyProfileId: registry.masters.cardIssuerPartyId,
        },
        {
          productId: registry.masters.productCm?.id,
          currencyId: registry.masters.currencyEur.id,
          quantity: 500,
          rate: 95.0,
          cardKitNumber: testCmKitNo,
          cardNumber: testCmCardNo,
          cardId: testCmCardId,
          issuerPartyProfileId: registry.masters.cardIssuerPartyId,
        },
      ],
      payments: [
        {
          paymentMethod: 'BANK_TRANSFER',
          amount: 88500 + 47500,
          accountId: registry.masters.bankAccountId,
          referenceDate: new Date().toISOString().slice(0, 10),
        },
      ],
    });

    if (![200, 201].includes(res.status)) {
      TestLogger.warn(`3B.2 CM sale draft failed (${res.status}): ${JSON.stringify(res.data)}`);
    }
    expect([200, 201]).toContain(res.status);
    const txnId = res.data?.id || res.data?.transaction?.id;
    expect(txnId).toBeDefined();

    const getRes = await client.get(`/transactions/${txnId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.data).toBeDefined();
    expect(getRes.data.id).toBe(txnId);
    TestLogger.success(`Verified GET /transactions/${txnId} round-trip (200 OK) for CM sale`);

    reconciler.recordOperationDelta({
      usdStockDelta: -1000,
      eurStockDelta: -500,
      bankDelta: 136000,
      transactionsCountDelta: 1,
    });
    TestLogger.success('CM multi-currency issuance succeeded across USD and EUR wallets');
  });

  it('3B.3 should reject sale with duplicate currency items for the same card', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.currencyUsd?.id).toBeDefined();

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      items: [
        {
          productId: registry.masters.productCm?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 500,
          rate: 88.5,
          cardKitNumber: testCmKitNo,
        },
        {
          productId: registry.masters.productCm?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 300,
          rate: 88.5,
          cardKitNumber: testCmKitNo,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Duplicate currency on same card correctly rejected');
  });

  it('3B.4 should return 404 for non-existent card stock receipt ID without 500 server error', async () => {
    const dummyReceiptId = '00000000-0000-0000-0000-000000009999';
    const res = await client.get(`/card-stock/receipts/${dummyReceiptId}`);
    expect([404, 400]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Non-existent card stock receipt returned 404 (no 500 error)');
  });

  it('3B.5 should reject CM transaction with non-existent card kit number', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.currencyUsd?.id).toBeDefined();

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      tradeMode: 'RETAIL',
      items: [
        {
          productId: registry.masters.productCm?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 100,
          rate: 88.5,
          cardKitNumber: 'KIT_NON_EXISTENT_99999',
          cardNumber: '5200999999999999',
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 8850,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('CM sale with unstocked/non-existent card kit number correctly rejected');
  });
});

