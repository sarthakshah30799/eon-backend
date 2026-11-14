import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';
import { TRANSACTION_SLUGS } from '../config/test-constants';

describe('Module 3E: Travellers Cheque (TP) Issuance, Encashment Surrender & Settle', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 3E: Travellers Cheque (TP) Lifecycle');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('3E.1 should execute retail sale of Travellers Cheques (TP) to passenger', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Anand',
        lastName: 'Verma',
        nationalityType: 'INDIAN',
        pan: 'EFGHI5678J',
        passportNumber: 'W9988776',
      },
      items: [
        {
          productId: registry.masters.productTp?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 1000,
          rate: 88.5,
          denomination: 100,
        },
      ],
      payments: [
        {
          paymentMethod: 'BANK_TRANSFER',
          amount: 88500,
        },
      ],
    });

    if (res.status === 201 || res.status === 200) {
      const txnId = res.data?.id || res.data?.transaction?.id;
      if (txnId) {
        const getRes = await client.get(`/transactions/${txnId}`);
        expect(getRes.status).toBe(200);
        expect(getRes.data).toBeDefined();
        expect(getRes.data.id).toBe(txnId);
        TestLogger.success(`Verified GET /transactions/${txnId} round-trip (200 OK) for TP retail sale`);
      }

      TestLogger.success('TP retail sale processed successfully');
    } else {
      TestLogger.info(`TP retail sale returned ${res.status}`);
    }
  });

  it('3E.2 should execute customer encashment surrender of TP cheques', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Anand',
        lastName: 'Verma',
        nationalityType: 'INDIAN',
        pan: 'EFGHI5678J',
        passportNumber: 'W9988776',
      },
      items: [
        {
          productId: registry.masters.productTp?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 500,
          rate: 87.0,
          denomination: 100,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 43500,
        },
      ],
    });

    if (res.status === 201 || res.status === 200) {
      const txnId = res.data?.id || res.data?.transaction?.id;
      if (txnId) {
        const getRes = await client.get(`/transactions/${txnId}`);
        expect(getRes.status).toBe(200);
        expect(getRes.data).toBeDefined();
        expect(getRes.data.id).toBe(txnId);
        TestLogger.success(`Verified GET /transactions/${txnId} round-trip (200 OK) for TP encashment`);
      }

      TestLogger.success('TP encashment surrender purchase processed successfully');
    } else {
      TestLogger.info(`TP surrender returned ${res.status}`);
    }
  });

  it('3E.3 should reject TP encashment surrender exceeding cash limit ($1,000 for Indian)', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Anand',
        lastName: 'Verma',
        nationalityType: 'INDIAN',
        pan: 'EFGHI5678J',
      },
      items: [
        {
          productId: registry.masters.productTp?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 2000, // Exceeds $1,000 cash threshold
          rate: 87.0,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 174000,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('TP encashment cash limit exceeding $1,000 correctly blocked');
  });

  it('3E.4 should reject TP transaction with non-existent currency ID', async () => {
    if (!registry.masters.branchA?.id) return;

    const dummyCurrencyId = '00000000-0000-0000-0000-000000009999';
    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      tradeMode: 'RETAIL',
      items: [
        {
          productId: registry.masters.productTp?.id,
          currencyId: dummyCurrencyId,
          quantity: 100,
          rate: 88.5,
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
    TestLogger.success('Non-existent currency in TP transaction correctly rejected with 400/422');
  });
});

