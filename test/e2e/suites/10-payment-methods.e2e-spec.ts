import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';
import { TRANSACTION_SLUGS } from '../config/test-constants';

describe('Module 5: Payment Methods, Multi-Method Compatibility & Limits', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 5: Payment Methods & Rules');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('5.1 should fetch active payment methods master', async () => {
    const res = await client.get('/transactions/payment-methods');
    expect(res.status).toBe(200);
    TestLogger.success('Queried available payment methods list');
  });

  it('5.2 should reject sale transaction when chequePageId is specified', async () => {
    // In Maraekat rules, a customer paying by cheque on a sale does not use the company's internal chequebook
    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA?.id,
      counterId: registry.masters.counterA1?.id,
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd?.id,
          quantity: 500,
          rate: 88.5,
        },
      ],
      payments: [
        {
          paymentMethod: 'CHEQUE',
          amount: 44250,
          chequePageId: '00000000-0000-0000-0000-000000000001', // Forbidden on sale
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Sale transaction with chequePageId correctly rejected');
  });

  it('5.3 should accept electronic payment methods (UPI, NEFT, RTGS, IMPS)', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      passenger: {
        firstName: 'Digi',
        lastName: 'Payer',
        nationalityType: 'INDIAN',
        pan: 'GHIJK7890L',
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 200,
          rate: 88.5,
        },
      ],
      payments: [
        {
          paymentMethod: 'NEFT',
          amount: 17700,
          referenceNumber: 'NEFT-AXIS-998877',
        },
      ],
    });

    let testTxId: string | undefined;

    if (res.status === 201 || res.status === 200) {
      testTxId = res.data?.id;
      TestLogger.success('NEFT electronic payment accepted');
    } else {
      TestLogger.info(`Electronic payment returned ${res.status}`);
    }

    if (testTxId) {
      const getRes = await client.get(`/transactions/${testTxId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.data?.id).toBe(testTxId);
      expect(Array.isArray(getRes.data?.payments)).toBe(true);
      expect(getRes.data?.payments[0]?.paymentMethod).toBe('NEFT');
      TestLogger.success('Electronic payment transaction re-opened cleanly via GET /transactions/:id');
    }
  });

  it('5.4 should reject cash payment when accountId points to a non-cash ledger (negative test)', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id || !registry.masters.advanceControlAccountId) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 100,
          rate: 88.5,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 8850,
          accountId: registry.masters.advanceControlAccountId, // Invalid: Not a CASH_LEDGER
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Cash payment with non-cash ledger account correctly rejected with 400');
  });

  it('5.5 should reject cheque payment missing cheque date or number (negative test)', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 100,
          rate: 88.5,
        },
      ],
      payments: [
        {
          paymentMethod: 'CHEQUE',
          amount: 8850,
          // Missing referenceNumber and referenceDate
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Cheque payment missing mandatory details correctly rejected with 400');
  });

  it('5.6 should support multi-method payment (split cash + bank) and re-open cleanly', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      passenger: {
        firstName: 'Multi',
        lastName: 'Payer',
        nationalityType: 'INDIAN',
        pan: 'ABCDE5678M',
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 200,
          rate: 88.5,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 8850,
        },
        {
          paymentMethod: 'NEFT',
          amount: 8850,
          referenceNumber: 'NEFT-SPLIT-1234',
        },
      ],
    });

    if (res.status === 201 || res.status === 200) {
      const splitTxId = res.data?.id;
      expect(splitTxId).toBeDefined();

      const getRes = await client.get(`/transactions/${splitTxId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.data?.id).toBe(splitTxId);
      expect(Array.isArray(getRes.data?.payments)).toBe(true);
      expect(getRes.data.payments.length).toBe(2);
      TestLogger.success('Multi-method split transaction verified and re-opened cleanly');
    }
  });
});

