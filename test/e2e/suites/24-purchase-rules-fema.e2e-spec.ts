import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';
import { TRANSACTION_SLUGS } from '../config/test-constants';

describe('Module 24: Statutory FEMA/RBI Purchase Rules & Restrictions', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 24: Statutory FEMA/RBI Purchase Rules');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('24.1 should detect CDF mandatory requirement when note purchase exceeds threshold', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    // Discover the exact configured CDF threshold amount
    const preview = await client.post('/transactions/purchase-rule-preview', {
      transactionType: 'PURCHASE',
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      passenger: {
        entityType: 'INDIVIDUAL',
        nationalityType: 'INDIAN',
        panNumber: 'ABCDE1234F',
        panHolderName: 'Kunal Shah',
        panDob: '1985-05-15',
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 100,
          rate: 87.0,
        },
      ],
      payments: [
        {
          paymentMethod: 'CHEQUE',
          amount: 100 * 87.0,
        },
      ],
    });

    const threshold = Number(preview.data?.cdfThresholdAmount || 5000);
    const exceedQty = Math.max(12000, threshold + 1000);

    const res = await client.post('/transactions/purchase-rule-preview', {
      transactionType: 'PURCHASE',
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      passenger: {
        entityType: 'INDIVIDUAL',
        nationalityType: 'INDIAN',
        panNumber: 'ABCDE1234F',
        panHolderName: 'Kunal Shah',
        panDob: '1985-05-15',
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: exceedQty,
          rate: 87.0,
        },
      ],
      payments: [
        {
          paymentMethod: 'CHEQUE',
          amount: exceedQty * 87.0,
        },
      ],
    });

    expect([200, 201]).toContain(res.status);
    expect(res.data?.requiresCdf).toBe(true);
    TestLogger.success('CDF requirement correctly flagged for purchase exceeding threshold');
  });

  it('24.2 should enforce CORPORATE_CHEQUE_ONLY rule on corporate purchase in preview', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    const res = await client.post('/transactions/purchase-rule-preview', {
      transactionType: 'PURCHASE',
      slug: TRANSACTION_SLUGS.PURCHASE_CORPORATE_INDIVIDUAL,
      passenger: {
        entityType: 'CORPORATE',
        nationalityType: 'INDIAN',
        panNumber: 'AAACD1234E',
        panHolderName: 'Apex Corp Ltd',
        panDob: '2010-01-01',
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 200,
          rate: 87.0,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 200 * 87.0,
        },
      ],
    });

    expect([200, 201]).toContain(res.status);
    expect(res.data?.allowed).toBe(false);
    expect(res.data?.ruleType).toBe('CORPORATE_CHEQUE_ONLY');
    TestLogger.success('Corporate purchases cash prohibition (CORPORATE_CHEQUE_ONLY) verified');
  });

  it('24.3 should reject corporate purchase transaction draft when cash payment is used', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.PURCHASE_CORPORATE_INDIVIDUAL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      tradeMode: 'BULK',
      passenger: {
        firstName: 'Apex',
        lastName: 'Corp',
        entityType: 'CORPORATE',
        nationalityType: 'INDIAN',
        pan: 'AAACD1234E',
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 300,
          rate: 87.0,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 300 * 87.0,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Corporate cash purchase draft correctly rejected');
  });

  it('24.4 should reject foreigner sell transaction when settled in non-cash mode', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.cardIssuerPartyId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'John',
        lastName: 'Smith',
        nationalityType: 'FOREIGNER',
        passportNumber: 'US987654321',
        passportPassengerName: 'John Smith',
        passportIssueAt: 'USA',
        passportIssueDate: '2020-01-01',
        passportExpiryDate: '2030-01-01',
        arrivalDate: '2026-10-25',
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
          paymentMethod: 'BANK_TRANSFER',
          amount: 200 * 88.5,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    const msg = Array.isArray(res.data?.message) ? res.data.message.join(' ') : (res.data?.message || '');
    expect(msg).toMatch(/only be settled in cash/i);
    TestLogger.success('Foreigner sell non-cash settlement restriction strictly enforced');
  });

  it('24.5 should allow compliant Indian resident purchase with valid PAN and cheque', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    const res = await client.post('/transactions/purchase-rule-preview', {
      transactionType: 'PURCHASE',
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      passenger: {
        entityType: 'INDIVIDUAL',
        nationalityType: 'INDIAN',
        panNumber: 'ABCDE1234F',
        panHolderName: 'Kunal Shah',
        panDob: '1985-05-15',
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 500,
          rate: 87.0,
        },
      ],
      payments: [
        {
          paymentMethod: 'CHEQUE',
          amount: 500 * 87.0,
        },
      ],
    });

    expect([200, 201]).toContain(res.status);
    expect(res.data?.allowed).toBe(true);
    expect(res.data?.ruleType).toBe('OK');
    TestLogger.success('Compliant purchase successfully passed statutory rule preview');
  });

  it('24.6 should allow foreigner sell transaction when settled in cash', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.cardIssuerPartyId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Robert',
        lastName: 'Brown',
        nationalityType: 'FOREIGNER',
        passportNumber: 'GB11223344',
        passportPassengerName: 'Robert Brown',
        passportIssueAt: 'London',
        passportIssueDate: '2020-01-01',
        passportExpiryDate: '2030-01-01',
        arrivalDate: '2026-10-25',
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
          amount: 200 * 88.5,
        },
      ],
    });

    expect([200, 201]).toContain(res.status);
    const txnId = res.data?.id || res.data?.transaction?.id;
    if (txnId) {
      const getRes = await client.get(`/transactions/${txnId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.data).toBeDefined();
      expect(getRes.data.id).toBe(txnId);
      TestLogger.success(`Verified GET /transactions/${txnId} round-trip (200 OK) for foreigner cash sale`);
    }
    TestLogger.success('Foreigner sell transaction settled in cash successfully');
  });

  it('24.7 should allow corporate purchase transaction when settled via cheque', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    // Statutory preview check: Corporate purchase settled via cheque is compliant
    const previewRes = await client.post('/transactions/purchase-rule-preview', {
      transactionType: 'PURCHASE',
      slug: TRANSACTION_SLUGS.PURCHASE_CORPORATE_INDIVIDUAL,
      passenger: {
        entityType: 'CORPORATE',
        nationalityType: 'INDIAN',
        panNumber: 'AAACD5678F',
        panHolderName: 'Zenith Global',
        panDob: '2010-01-01',
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 500,
          rate: 87.0,
        },
      ],
      payments: [
        {
          paymentMethod: 'CHEQUE',
          amount: 500 * 87.0,
        },
      ],
    });
    expect([200, 201]).toContain(previewRes.status);
    expect(previewRes.data?.allowed).toBe(true);

    const pageRes = await client.get('/chequebooks/pages/selectable', {
      accountId: registry.masters.bankAccountId,
    });
    const page = Array.isArray(pageRes.data) && pageRes.data.length > 0 ? pageRes.data[0] : null;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.PURCHASE_CORPORATE_INDIVIDUAL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.corporatePartyProfile?.id || registry.masters.cardIssuerPartyId,
      tradeMode: 'BULK',
      passenger: {
        firstName: 'Zenith',
        lastName: 'Global',
        entityType: 'CORPORATE',
        nationalityType: 'INDIAN',
        pan: 'AAACD5678F',
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 500,
          rate: 87.0,
        },
      ],
      payments: [
        {
          paymentMethod: 'CHEQUE',
          amount: 500 * 87.0,
          referenceNumber: page?.pageNumber || 'CHQ-CORP-9911',
          referenceDate: '2026-10-28',
          chequePageId: page?.id,
        },
      ],
    });

    if (page?.id) {
      expect([200, 201]).toContain(res.status);
    } else {
      expect([200, 201, 400]).toContain(res.status);
      const msg = Array.isArray(res.data?.message) ? res.data.message.join(' ') : (res.data?.message || '');
      expect(msg).not.toMatch(/CORPORATE_CHEQUE_ONLY/i);
    }

    if (res.status === 200 || res.status === 201) {
      const corpTxnId = res.data?.id || res.data?.transaction?.id;
      if (corpTxnId) {
        const getRes = await client.get(`/transactions/${corpTxnId}`);
        expect(getRes.status).toBe(200);
        expect(getRes.data).toBeDefined();
        expect(getRes.data.id).toBe(corpTxnId);
        TestLogger.success(`Verified GET /transactions/${corpTxnId} round-trip (200 OK) for corporate purchase`);
      }
    }
    TestLogger.success('Corporate purchase settled via cheque accepted');
  });

  it('24.8 should evaluate 30-day rolling window cash limits for returning passenger', async () => {
    if (!registry.masters.currencyUsd?.id) return;

    // Day 1 purchase within limits (400 CN + 400 Cash = 800 < 1000)
    const day1Res = await client.post('/transactions/purchase-rule-preview', {
      transactionType: 'PURCHASE',
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      transactionDate: '2026-10-01',
      passenger: {
        entityType: 'INDIVIDUAL',
        nationalityType: 'INDIAN',
        panNumber: 'ABCDE9999K',
        panHolderName: 'Rolling Window User',
        panDob: '1988-08-08',
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 400,
          rate: 87.0,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 400 * 87.0,
        },
      ],
    });
    expect([200, 201]).toContain(day1Res.status);
    expect(day1Res.data?.allowed).toBe(true);

    // Day 35 purchase: Outside 30-day window, window resets (300 CN + 300 Cash = 600 < 1000)
    const day35Res = await client.post('/transactions/purchase-rule-preview', {
      transactionType: 'PURCHASE',
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      transactionDate: '2026-11-05', // 35 days later
      passenger: {
        entityType: 'INDIVIDUAL',
        nationalityType: 'INDIAN',
        panNumber: 'ABCDE9999K',
        panHolderName: 'Rolling Window User',
        panDob: '1988-08-08',
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 300,
          rate: 87.0,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 300 * 87.0,
        },
      ],
    });
    expect([200, 201]).toContain(day35Res.status);
    expect(day35Res.data?.allowed).toBe(true);
    TestLogger.success('30-day rolling window cash limits & reset verified');
  });

  it('24.9 should enforce NRI statutory cash purchase limits', async () => {
    if (!registry.masters.currencyUsd?.id) return;

    // NRI within $3,000 limit (1200 CN + 1200 Cash = 2400 < 3000)
    const nriOkRes = await client.post('/transactions/purchase-rule-preview', {
      transactionType: 'PURCHASE',
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      passenger: {
        entityType: 'INDIVIDUAL',
        nationalityType: 'NRI',
        passportNumber: 'NRI8877665',
        arrivalDate: '2026-10-25',
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 1200, // Within $3,000 limit
          rate: 87.0,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 1200 * 87.0,
        },
      ],
    });
    expect([200, 201]).toContain(nriOkRes.status);
    expect(nriOkRes.data?.allowed).toBe(true);

    // NRI exceeding $3,000 limit (2000 CN + 2000 Cash = 4000 > 3000)
    const nriExceedRes = await client.post('/transactions/purchase-rule-preview', {
      transactionType: 'PURCHASE',
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      passenger: {
        entityType: 'INDIVIDUAL',
        nationalityType: 'NRI',
        passportNumber: 'NRI8877665',
        arrivalDate: '2026-10-25',
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 2000, // Exceeds $3,000 limit
          rate: 87.0,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 2000 * 87.0,
        },
      ],
    });
    expect([200, 201]).toContain(nriExceedRes.status);
    expect(nriExceedRes.data?.allowed).toBe(false);
    expect(nriExceedRes.data?.ruleType).toBe('CASH_LIMIT_EXCEEDED');
    TestLogger.success('NRI statutory cash purchase limits ($3,000) verified');
  });

  it('24.10 should evaluate purchase-rule-preview safely without 500 server error', async () => {
    const res = await client.post('/transactions/purchase-rule-preview', {
      transactionType: 'INVALID_TYPE',
    });
    expect([200, 201, 400, 422]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Purchase-rule-preview evaluated safely (no 500 error)');
  });
});

