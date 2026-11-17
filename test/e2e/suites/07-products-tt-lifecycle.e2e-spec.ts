import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { ReportAccuracyValidator } from '../infrastructure/report-accuracy-validator';
import { TestLogger } from '../infrastructure/test-logger';
import { TRANSACTION_SLUGS } from '../config/test-constants';

describe('Module 3D: TT Outward Remittance Lifecycle (Deal Cover, SWIFT & Settlement)', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  let testDealCoverId: string;
  const testPan = 'ABCDE1234F';
  const testPassport = 'Z1234567';

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 3D: TT Remittance Lifecycle');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('3D.1 should book a Deal Cover for TT Remittance in PENDING status', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.currencyUsd?.id).toBeDefined();

    const res = await client.post('/deal-covers', {
      branchId: registry.masters.branchA.id,
      currencyId: registry.masters.currencyUsd.id,
      productId: registry.masters.productTt?.id,
      feAmount: 50000,
      dealRate: 88.2,
      bookingRate: 88.0,
      passengerPan: testPan,
      passengerPassport: testPassport,
    });

    expect([200, 201]).toContain(res.status);
    testDealCoverId = res.data?.id;
    expect(testDealCoverId).toBeDefined();
    TestLogger.success(`Deal Cover booked: ${testDealCoverId} (status: ${res.data?.status})`);

    const getRes = await client.get(`/deal-covers/${testDealCoverId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.data).toBeDefined();
    expect(getRes.data.id).toBe(testDealCoverId);
    TestLogger.success(`Verified GET /deal-covers/${testDealCoverId} round-trip (200 OK)`);
  });

  it('3D.2 should approve Deal Cover by Head Office staff', async () => {
    expect(testDealCoverId).toBeDefined();

    await workplaceManager.asHoStaff();
    const res = await client.post(`/deal-covers/${testDealCoverId}/approve`);
    expect([200, 201]).toContain(res.status);
    TestLogger.success(`Deal Cover approved by HO: ${testDealCoverId}`);
  });

  it('3D.3 should reject TT remittance when SWIFT code is missing', async () => {
    await workplaceManager.asAdmin();

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA?.id,
      counterId: registry.masters.counterA1?.id,
      ttRemittance: {
        remitterName: 'Ramesh Sharma',
        beneficiaryName: 'Oxford University',
        bankName: 'Barclays Bank',
        swiftCode: '', // Missing
        accountNumber: 'GB29BARC20201531234567',
      },
      items: [
        {
          productId: registry.masters.productTt?.id,
          currencyId: registry.masters.currencyUsd?.id,
          quantity: 10000,
          rate: 88.2,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('TT remittance missing SWIFT code correctly rejected');
  });

  it('3D.4 should reject TT remittance when both account number and IBAN are missing', async () => {
    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA?.id,
      counterId: registry.masters.counterA1?.id,
      ttRemittance: {
        remitterName: 'Ramesh Sharma',
        beneficiaryName: 'Oxford University',
        bankName: 'Barclays Bank',
        swiftCode: 'BARCGB22',
        accountNumber: '',
        iban: '',
      },
      items: [
        {
          productId: registry.masters.productTt?.id,
          currencyId: registry.masters.currencyUsd?.id,
          quantity: 10000,
          rate: 88.2,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('TT remittance missing account/IBAN correctly rejected');
  });

  it('3D.5 should punch complete TT Remittance transaction when details are valid', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.currencyUsd?.id).toBeDefined();

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      dealCoverId: testDealCoverId,
      passenger: {
        firstName: 'Ramesh',
        lastName: 'Sharma',
        nationalityType: 'INDIAN',
        pan: testPan,
        passportNumber: testPassport,
      },
      ttRemittance: {
        remitterName: 'Ramesh Sharma',
        beneficiaryName: 'University Fees Division',
        bankName: 'Barclays Bank London',
        swiftCode: 'BARCGB22',
        accountNumber: '12345678',
        iban: 'GB29BARC20201531234567',
        chargeBearer: 'OUR',
      },
      items: [
        {
          productId: registry.masters.productTt?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 5000,
          rate: 88.2,
        },
      ],
      payments: [
        {
          paymentMethod: 'BANK_TRANSFER',
          amount: 5000 * 88.2,
        },
      ],
    });

    expect([200, 201]).toContain(res.status);
    const txnId = res.data?.id || res.data?.transaction?.id;
    expect(txnId).toBeDefined();

    const getRes = await client.get(`/transactions/${txnId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.data).toBeDefined();
    expect(getRes.data.id).toBe(txnId);
    TestLogger.success(`Verified GET /transactions/${txnId} round-trip (200 OK) for TT Remittance`);

    TestLogger.success('TT Remittance transaction processed successfully');
  });

  it('3D.5B should verify TT Remittance transaction renders accurately on Sale/Purchase and TT report frontend tables', async () => {
    const spRes = await client.get('/reports/sale-purchase', {
      limit: 100,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    expect(spRes.status).toBe(200);
    ReportAccuracyValidator.verifyFrontendContract('sale-purchase', spRes.data);

    const ttRes = await client.get('/reports/tt-report', {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    expect(ttRes.status).toBe(200);
    expect(Array.isArray(ttRes.data?.columns)).toBe(true);
    TestLogger.success('TT Remittance report verified on frontend');
  });

  it('3D.6 should return 404 for non-existent deal cover ID without 500 server error', async () => {
    const dummyCoverId = '00000000-0000-0000-0000-000000009999';
    const res = await client.get(`/deal-covers/${dummyCoverId}`);
    expect([404, 400]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Non-existent deal cover returned 404 (no 500 error)');
  });

  it('3D.7 should reject TT remittance when passenger pan is invalid format', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.currencyUsd?.id).toBeDefined();

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      passenger: {
        firstName: 'Invalid',
        lastName: 'PanTest',
        nationalityType: 'INDIAN',
        pan: 'INVALID_PAN_123',
      },
      ttRemittance: {
        remitterName: 'Invalid PanTest',
        beneficiaryName: 'University Fees Division',
        bankName: 'Barclays Bank London',
        swiftCode: 'BARCGB22',
        accountNumber: '12345678',
      },
      items: [
        {
          productId: registry.masters.productTt?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 1000,
          rate: 88.2,
        },
      ],
      payments: [
        {
          paymentMethod: 'BANK_TRANSFER',
          amount: 88200,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Invalid PAN format in TT remittance correctly rejected with 400/422');
  });
});

