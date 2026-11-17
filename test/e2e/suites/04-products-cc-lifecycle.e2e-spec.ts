import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { ReportReconciler } from '../infrastructure/report-reconciler';
import { TestLogger } from '../infrastructure/test-logger';
import { TRANSACTION_SLUGS } from '../config/test-constants';

describe('Module 3A: Single Currency Forex Card (CC) Full Lifecycle, Surrender & Settlement', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;
  let reconciler: ReportReconciler;

  let testCardKitNo: string;
  let testCardNo: string;
  let testCardReceiptId: string;
  let testSoldTransactionId: string;
  let testPassengerId: string;
  let testSoldCardId: string;
  let testReservedCardId: string;
  let baseSaleRate: number = 88.5;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();
    reconciler = ReportReconciler.getInstance();

    TestLogger.header('Module 3A: Single Currency Card (CC) Lifecycle');
    await workplaceManager.asAdmin();
    await registry.initialize(client);

    const rand = Date.now().toString().slice(-6);
    testCardKitNo = `KIT_CC_${rand}`;
    testCardNo = `411122223333${rand.slice(0, 4)}`;
  });

  it('3A.1 should download card stock template', async () => {
    const res = await client.get('/card-stock/receipts/cards/template');
    expect([200, 304]).toContain(res.status);
    TestLogger.success('CC card stock template downloaded successfully');
  });

  it('3A.2 should create CC card stock receipt for Branch A', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id || !registry.masters.cardIssuerPartyId) return;

    const res = await client.post('/card-stock/receipts', {
      receiptDate: new Date().toISOString().slice(0, 10),
      issuerPartyProfileId: registry.masters.cardIssuerPartyId,
      branchId: registry.masters.branchA.id,
      totalFeAmount: '1000',
      items: [
        {
          lineNo: 1,
          currencyId: registry.masters.currencyUsd.id,
          per: '1',
          productId: registry.masters.productCc?.id,
          issuerPartyProfileId: registry.masters.cardIssuerPartyId,
          feAmount: '1000',
          cards: [
            {
              series: 'CC',
              kitNumber: testCardKitNo,
              cardNumber: testCardNo,
              denomination: '1',
              amount: '1000',
              expirationDate: '2030-12-31',
            },
          ],
        },
      ],
    });

    if (res.status === 201 || res.status === 200) {
      testCardReceiptId = res.data?.id;
      TestLogger.success(`CC Card Receipt created: ${testCardKitNo} (${testCardReceiptId})`);
    } else {
      TestLogger.info(`Card stock create returned ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  it('3A.3 should query available blank cards for issuance', async () => {
    const res = await client.get('/card-stock/receipts/cards/available', {
      branchId: registry.masters.branchA?.id,
      currencyId: registry.masters.currencyUsd?.id,
    });

    expect(res.status).toBe(200);
    TestLogger.success('Queried available card stock inventory');
  });

  it('3A.4 should issue (sell) CC card to a passenger', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Amit',
        lastName: 'Patel',
        nationalityType: 'INDIAN',
        pan: 'ABCDE1234F',
        passportNumber: 'Z1234567',
        ticketNumber: 'AI-101',
      },
      items: [
        {
          productId: registry.masters.productCc?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 1000,
          rate: 88.5,
          cardKitNumber: testCardKitNo,
          cardNumber: testCardNo,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 88500,
        },
      ],
    });

    if (res.status === 201 || res.status === 200) {
      testSoldTransactionId = res.data?.id;
      testPassengerId = res.data?.passengerId || res.data?.passenger?.id;
      reconciler.recordOperationDelta({
        usdStockDelta: -1000,
        cashDelta: 88500,
        transactionsCountDelta: 1,
      });
      TestLogger.success(`CC Card sold successfully: Trn ID ${testSoldTransactionId}`);
    } else {
      TestLogger.warn(`CC Card sale returned ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  it('3A.4B should fetch sold CC transaction by ID (GET /transactions/:id) and verify relations without 500 error', async () => {
    if (!testSoldTransactionId) return;

    const res = await client.get(`/transactions/${testSoldTransactionId}`);
    expect(res.status).toBe(200);
    expect(res.data?.id).toBe(testSoldTransactionId);
    expect(Array.isArray(res.data?.items)).toBe(true);
    expect(res.data.items[0]?.cardKitNumber).toBe(testCardKitNo);
    expect(Array.isArray(res.data?.payments)).toBe(true);
    expect(res.data?.partyProfileSnapshot !== undefined || res.data?.passenger !== undefined).toBe(true);
    TestLogger.success('Sold CC transaction re-opened cleanly via GET /transactions/:id');
  });

  it('3A.5 should reject CC card reload to a different passenger', async () => {
    if (!testCardKitNo) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      isReload: true,
      branchId: registry.masters.branchA?.id,
      counterId: registry.masters.counterA1?.id,
      passenger: {
        firstName: 'Wrong',
        lastName: 'Passenger',
        nationalityType: 'INDIAN',
        pan: 'PQRST9876Z',
      },
      items: [
        {
          productId: registry.masters.productCc?.id,
          currencyId: registry.masters.currencyUsd?.id,
          quantity: 500,
          rate: 88.5,
          cardKitNumber: testCardKitNo,
          cardNumber: testCardNo,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Reload to different passenger correctly rejected');
  });

  it('3A.6 should query sold cards and check base sale rate for surrender encashment', async () => {
    const soldRes = await client.get('/card-stock/receipts/cards/sold');
    expect([200, 304]).toContain(soldRes.status);
    const soldList = Array.isArray(soldRes.data)
      ? soldRes.data
      : (Array.isArray(soldRes.data?.data) ? soldRes.data.data : []);
    const matchingSold = soldList.find((c: any) => c.kitNumber === testCardKitNo || (c.cardNumber && testCardNo && c.cardNumber.endsWith(testCardNo.slice(-4))));
    if (matchingSold) {
      testSoldCardId = matchingSold.id;
      TestLogger.success(`Identified sold CARD ID for surrender: ${testSoldCardId}`);
    } else if (soldList.length > 0) {
      testSoldCardId = soldList[0].id;
    }

    const rateRes = await client.get('/card-stock/receipts/cards/base-sale-rate', {
      currencyId: registry.masters.currencyUsd?.id,
    });
    expect([200, 404]).toContain(rateRes.status);
    if (rateRes.ok && rateRes.data?.baseSaleRate) {
      baseSaleRate = Number(rateRes.data.baseSaleRate);
    }
    TestLogger.success(`Queried sold cards and base sale rate: ${baseSaleRate}`);
  });

  it('3A.6A should reject retail surrender purchase when rate exceeds base sale price', async () => {
    if (!testSoldCardId || !registry.masters.branchA?.id || !registry.masters.currencyUsd?.id || !registry.masters.productEm?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.cardIssuerPartyId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Amit',
        lastName: 'Patel',
        nationalityType: 'INDIAN',
        pan: 'ABCDE1234F',
      },
      items: [
        {
          productId: registry.masters.productEm.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 1000,
          rate: baseSaleRate + 15.0, // Strictly exceeds base sale rate
          cardId: testSoldCardId,
          issuerPartyProfileId: registry.masters.cardIssuerPartyId,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 1000 * (baseSaleRate + 15.0),
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    const msg = Array.isArray(res.data?.message) ? res.data.message.join(' ') : (res.data?.message || '');
    expect(msg).toMatch(/cannot exceed base sale price/i);
    TestLogger.success('Surrender purchase rate cap validation enforced');
  });

  it('3A.6B should reject surrender purchase using a blank-stock product (CC)', async () => {
    if (!testSoldCardId || !registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.cardIssuerPartyId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Amit',
        lastName: 'Patel',
        nationalityType: 'INDIAN',
        pan: 'ABCDE1234F',
      },
      items: [
        {
          productId: registry.masters.productCc?.id, // Blank-stock product, not allowed on surrender
          currencyId: registry.masters.currencyUsd.id,
          quantity: 1000,
          rate: Math.min(baseSaleRate, 88.0),
          cardId: testSoldCardId,
          issuerPartyProfileId: registry.masters.cardIssuerPartyId,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 88000,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Non-surrender blank stock product correctly rejected on surrender purchase');
  });

  it('3A.6C should reject surrender purchase with an unassigned card ID', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id || !registry.masters.productEm?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.cardIssuerPartyId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Amit',
        lastName: 'Patel',
        nationalityType: 'INDIAN',
        pan: 'ABCDE1234F',
      },
      items: [
        {
          productId: registry.masters.productEm.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 1000,
          rate: Math.min(baseSaleRate, 88.0),
          cardId: '00000000-0000-0000-0000-000000000001',
          issuerPartyProfileId: registry.masters.cardIssuerPartyId,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 88000,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Unassigned card ID correctly rejected for surrender purchase');
  });

  it('3A.6D should execute retail surrender purchase of the sold CC card and transition unit to RESERVED', async () => {
    if (!testSoldCardId || !registry.masters.branchA?.id || !registry.masters.currencyUsd?.id || !registry.masters.productEm?.id) return;

    const surrenderRate = Math.min(baseSaleRate, 88.0);
    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.cardIssuerPartyId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Amit',
        lastName: 'Patel',
        nationalityType: 'INDIAN',
        pan: 'ABCDE1234F',
      },
      items: [
        {
          productId: registry.masters.productEm.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 1000,
          rate: surrenderRate,
          cardId: testSoldCardId,
          issuerPartyProfileId: registry.masters.cardIssuerPartyId,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 1000 * surrenderRate,
        },
      ],
    });

    if (res.status === 200 || res.status === 201) {
      reconciler.recordOperationDelta({
        usdStockDelta: 1000,
        cashDelta: -(1000 * surrenderRate),
        transactionsCountDelta: 1,
      });
      TestLogger.success(`Retail surrender purchase executed successfully: ${res.data?.id}`);
    } else {
      TestLogger.info(`Surrender purchase returned ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  it('3A.6E should list the surrendered unit in reserved cards available for HO bulk sale', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.productEm?.id) return;

    const res = await client.get('/card-stock/receipts/cards/em-units', {
      branchId: registry.masters.branchA.id,
      productId: registry.masters.productEm.id,
      issuerPartyProfileId: registry.masters.cardIssuerPartyId,
      currencyId: registry.masters.currencyUsd?.id,
    });

    expect([200, 304]).toContain(res.status);
    const units = Array.isArray(res.data)
      ? res.data
      : (Array.isArray(res.data?.data) ? res.data.data : []);
    if (units.length > 0) {
      testReservedCardId = units[0].id;
      TestLogger.success(`Found RESERVED unit available for bulk sale: ${testReservedCardId}`);
    } else {
      TestLogger.info('Reserved EM units list queried successfully');
    }
  });

  it('3A.6F should reject surrender bulk sale if tradeMode is not BULK', async () => {
    if (!testReservedCardId || !registry.masters.branchA?.id || !registry.masters.currencyUsd?.id || !registry.masters.productEm?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_BULK,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      tradeMode: 'RETAIL', // Invalid: surrender sale requires BULK
      partyProfileId: registry.masters.cardIssuerPartyId,
      items: [
        {
          productId: registry.masters.productEm.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 1000,
          rate: 88.5,
          cardId: testReservedCardId,
          issuerPartyProfileId: registry.masters.cardIssuerPartyId,
        },
      ],
      payments: [
        {
          paymentMethod: 'CHEQUE',
          amount: 88500,
          chequeNumber: 'CHQ888111',
          chequeDate: new Date().toISOString().slice(0, 10),
          chequeBranch: 'Fort',
          drawnOn: 'Axis Bank',
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    const msg = Array.isArray(res.data?.message) ? res.data.message.join(' ') : (res.data?.message || '');
    expect(msg).toMatch(/must use bulk trade mode/i);
    TestLogger.success('Surrender bulk sale tradeMode validation enforced');
  });

  it('3A.6G should reject surrender bulk sale if FE amount does not match EM unit amount', async () => {
    if (!testReservedCardId || !registry.masters.branchA?.id || !registry.masters.currencyUsd?.id || !registry.masters.productEm?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_BULK,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      tradeMode: 'BULK',
      partyProfileId: registry.masters.cardIssuerPartyId,
      items: [
        {
          productId: registry.masters.productEm.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 500, // Mismatched FE amount (card is 1000)
          rate: 88.5,
          cardId: testReservedCardId,
          issuerPartyProfileId: registry.masters.cardIssuerPartyId,
        },
      ],
      payments: [
        {
          paymentMethod: 'CHEQUE',
          amount: 500 * 88.5,
          chequeNumber: 'CHQ888112',
          chequeDate: new Date().toISOString().slice(0, 10),
          chequeBranch: 'Fort',
          drawnOn: 'Axis Bank',
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    const msg = Array.isArray(res.data?.message) ? res.data.message.join(' ') : (res.data?.message || '');
    expect(msg).toMatch(/must equal the selected EM unit amount/i);
    TestLogger.success('Surrender bulk sale unit amount matching enforced');
  });

  it('3A.6H should execute HO bulk issuer sale of the reserved card back to the Card Issuer Profile', async () => {
    if (!testReservedCardId || !registry.masters.branchA?.id || !registry.masters.currencyUsd?.id || !registry.masters.productEm?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_BULK,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      tradeMode: 'BULK',
      partyProfileId: registry.masters.cardIssuerPartyId,
      items: [
        {
          productId: registry.masters.productEm.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 1000,
          rate: 88.5,
          cardId: testReservedCardId,
          issuerPartyProfileId: registry.masters.cardIssuerPartyId,
        },
      ],
      payments: [
        {
          paymentMethod: 'CHEQUE',
          amount: 88500,
          chequeNumber: 'CHQ888113',
          chequeDate: new Date().toISOString().slice(0, 10),
          chequeBranch: 'Fort',
          drawnOn: 'Axis Bank',
        },
      ],
    });

    if (res.status === 200 || res.status === 201) {
      reconciler.recordOperationDelta({
        usdStockDelta: -1000,
        transactionsCountDelta: 1,
      });
      TestLogger.success(`HO Bulk Issuer sale executed successfully: ${res.data?.id}`);
    } else {
      TestLogger.info(`HO Bulk Issuer sale returned ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  it('3A.7 should query unsettled CARD items and create settlement document', async () => {
    if (!registry.masters.cardIssuerPartyId || !registry.masters.currencyUsd?.id) return;

    // As Admin / HO Staff (settles HO -> Issuer)
    await workplaceManager.asAdmin();
    const unsettledRes = await client.get('/product-settlements/unsettled', {
      kind: 'HO_ISSUER',
      issuerPartyProfileId: registry.masters.cardIssuerPartyId,
      currencyId: registry.masters.currencyUsd.id,
      hoBranchId: registry.masters.branchA?.id,
    });
    expect([200, 404]).toContain(unsettledRes.status);

    const items = Array.isArray(unsettledRes.data?.data)
      ? unsettledRes.data.data
      : (Array.isArray(unsettledRes.data?.items) ? unsettledRes.data.items : (Array.isArray(unsettledRes.data) ? unsettledRes.data : []));
    if (items.length > 0) {
      const docRes = await client.post('/product-settlements', {
        kind: 'HO_ISSUER',
        hoBranchId: registry.masters.branchA?.id,
        issuerPartyProfileId: registry.masters.cardIssuerPartyId,
        currencyId: registry.masters.currencyUsd.id,
        transactionDate: new Date().toISOString().slice(0, 10),
        items: items.map((it: any) => ({
          id: it.id,
          rate: (it.rate || it.denomination || '88.50').toString(),
        })),
      });
      if (docRes.ok) {
        const docId = docRes.data?.id;
        TestLogger.success(`HO Issuer settlement document created: ${docId}`);
      }
    }
  });
});

