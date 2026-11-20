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
  let testDealNo: string;
  const testBookingRate = '88.25';
  let testTtTransactionId: string;
  let testTtSettlementItemId: string;

  const testPan = 'ABCDE1234F';
  const testPassport = 'Z1234567';
  const dealFeAmount = '50000.00';

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
    expect(registry.masters.productTt?.id).toBeDefined();
    expect(registry.masters.bankAccountId).toBeDefined();
    expect(registry.masters.corporatePartyProfile?.id).toBeDefined();
    expect(registry.masters.cardIssuerPartyId).toBeDefined();

    const policyRes = await client.get(`/auth/policy-context?branchId=${registry.masters.branchA.id}`);
    const txDate = policyRes.data?.transactionDate || registry.masters.transactionDate || new Date().toISOString().slice(0, 10);
    let purposeId = registry.masters.purposeId;
    if (!purposeId) {
      const purpRes = await client.get('/purposes', { limit: 10 });
      const purposes = Array.isArray(purpRes.data?.data) ? purpRes.data.data : (Array.isArray(purpRes.data?.items) ? purpRes.data.items : (Array.isArray(purpRes.data) ? purpRes.data : []));
      if (purposes.length > 0) {
        purposeId = purposes[0].id;
        registry.masters.purposeId = purposeId;
      }
    }
    const maturityOptionId = registry.masters.ttMaturityOptionId;

    const res = await client.post('/deal-covers', {
      branchId: registry.masters.branchA.id,
      transactionDate: txDate,
      bankAccountProfileId: registry.masters.bankAccountId,
      productId: registry.masters.productTt!.id,
      partyProfileType: 'CORPORATE_CLIENT',
      partyProfileId: registry.masters.corporatePartyProfile!.id,
      purposeId,
      currencyId: registry.masters.currencyUsd.id,
      issuerPartyProfileId: registry.masters.cardIssuerPartyId,
      feAmount: dealFeAmount,
      maturityOptionId,
      passengerPan: testPan,
      passengerPassport: testPassport,
    });

    if (![200, 201].includes(res.status)) {
      TestLogger.warn(`3D.1 deal cover booking failed (${res.status}): ${JSON.stringify(res.data)}`);
    }
    expect([200, 201]).toContain(res.status);
    testDealCoverId = res.data?.id;
    expect(testDealCoverId).toBeDefined();
    expect(res.data?.status).toBe('PENDING');
    TestLogger.success(`Deal Cover booked: ${testDealCoverId} (status: ${res.data?.status})`);

    const getRes = await client.get(`/deal-covers/${testDealCoverId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.data).toBeDefined();
    expect(getRes.data.id).toBe(testDealCoverId);
    expect(getRes.data.status).toBe('PENDING');
    TestLogger.success(`Verified GET /deal-covers/${testDealCoverId} round-trip (200 OK)`);
  });

  it('3D.2 should verify booked deal cover appears in Head Office Acknowledgement queue (GET /deal-covers/ack)', async () => {
    expect(testDealCoverId).toBeDefined();

    const ackRes = await client.get('/deal-covers/ack', {
      branchId: registry.masters.branchA.id,
      currencyId: registry.masters.currencyUsd.id,
      limit: 100,
    });

    expect([200, 304]).toContain(ackRes.status);
    const rows = Array.isArray(ackRes.data?.data)
      ? ackRes.data.data
      : (Array.isArray(ackRes.data?.items) ? ackRes.data.items : (Array.isArray(ackRes.data) ? ackRes.data : []));

    const matchedDeal = rows.find((d: any) => d.id === testDealCoverId);
    expect(matchedDeal).toBeDefined();
    expect(matchedDeal.status).toBe('PENDING');
    expect(Number(matchedDeal.feAmount)).toBe(Number(dealFeAmount));
    TestLogger.success(`Verified deal cover ${testDealCoverId} in HO Acknowledgement queue`);
  });

  it('3D.3 should acknowledge and approve Deal Cover by Head Office staff with dealNo and bookingRate', async () => {
    expect(testDealCoverId).toBeDefined();

    testDealNo = `DL_TEST_${Date.now().toString().slice(-6)}`;

    await workplaceManager.asHoStaff();
    const res = await client.post(`/deal-covers/${testDealCoverId}/approve`, {
      dealNo: testDealNo,
      bookingRate: testBookingRate,
    });

    if (![200, 201].includes(res.status)) {
      TestLogger.warn(`3D.1 deal cover booking failed (${res.status}): ${JSON.stringify(res.data)}`);
    }
    expect([200, 201]).toContain(res.status);
    TestLogger.success(`Deal Cover acknowledged and approved by HO: ${testDealCoverId} (dealNo: ${testDealNo})`);

    await workplaceManager.asAdmin();
    const getRes = await client.get(`/deal-covers/${testDealCoverId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.data?.status).toBe('APPROVED');
    expect(getRes.data?.dealNo).toBe(testDealNo);
    expect(Number(getRes.data?.bookingRate)).toBe(Number(testBookingRate));
    TestLogger.success(`Verified Deal Cover ${testDealCoverId} state transitioned to APPROVED`);
  });

  it('3D.4 should reject TT remittance punch when FE quantity does not match deal cover FE amount exactly (negative test)', async () => {
    expect(testDealCoverId).toBeDefined();
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.currencyUsd?.id).toBeDefined();

    const policyRes = await client.get(`/auth/policy-context?branchId=${registry.masters.branchA.id}`);
    const txDate = policyRes.data?.transactionDate || registry.masters.transactionDate || new Date().toISOString().slice(0, 10);

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.corporatePartyProfile?.id,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Ramesh',
        lastName: 'Sharma',
        nationalityType: 'INDIAN',
        pan: testPan,
        passportNumber: testPassport,
      },
      passengerTravel: {
        travellingCountryId: registry.masters.countryId,
      },
      ttRemittance: {
        remitterName: 'Ramesh Sharma',
        beneficiaryName: 'Oxford University',
        bankName: 'Barclays Bank London',
        swiftCode: 'BARCGB22',
        accountNumber: 'GB29BARC20201531234567',
        chargeBearer: 'OUR',
      },
      items: [
        {
          productId: registry.masters.productTt?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 10000, // Mismatch: punched 10,000 vs Deal Cover 50,000
          rate: Number(testBookingRate),
          dealCoverId: testDealCoverId,
          issuerPartyProfileId: registry.masters.cardIssuerPartyId,
        },
      ],
      payments: [
        {
          paymentMethod: 'BANK_TRANSFER',
          amount: 10000 * Number(testBookingRate),
          accountId: registry.masters.bankAccountId,
          referenceDate: txDate,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    const msg = Array.isArray(res.data?.message) ? res.data.message.join(' ') : (res.data?.message || '');
    expect(msg.toLowerCase()).toContain('fe amount must equal the deal fe amount');
    TestLogger.success('Mismatched FE amount against deal cover correctly rejected with 400 Bad Request');
  });

  it('3D.5 should reject TT remittance punch when passenger PAN does not match deal cover (negative test)', async () => {
    expect(testDealCoverId).toBeDefined();

    const policyRes = await client.get(`/auth/policy-context?branchId=${registry.masters.branchA.id}`);
    const txDate = policyRes.data?.transactionDate || registry.masters.transactionDate || new Date().toISOString().slice(0, 10);

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.corporatePartyProfile?.id,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Wrong',
        lastName: 'Passenger',
        nationalityType: 'INDIAN',
        pan: 'WXYZP9999K', // Mismatched PAN vs Deal Cover
        passportNumber: testPassport,
      },
      passengerTravel: {
        travellingCountryId: registry.masters.countryId,
      },
      ttRemittance: {
        remitterName: 'Ramesh Sharma',
        beneficiaryName: 'Oxford University',
        bankName: 'Barclays Bank London',
        swiftCode: 'BARCGB22',
        accountNumber: 'GB29BARC20201531234567',
        chargeBearer: 'OUR',
      },
      items: [
        {
          productId: registry.masters.productTt?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 50000,
          rate: Number(testBookingRate),
          dealCoverId: testDealCoverId,
          issuerPartyProfileId: registry.masters.cardIssuerPartyId,
        },
      ],
      payments: [
        {
          paymentMethod: 'BANK_TRANSFER',
          amount: 50000 * Number(testBookingRate),
          accountId: registry.masters.bankAccountId,
          referenceDate: txDate,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    const msg = Array.isArray(res.data?.message) ? res.data.message.join(' ') : (res.data?.message || '');
    expect(msg.toLowerCase()).toContain('pan');
    TestLogger.success('Passenger PAN mismatch against deal cover correctly rejected with 400 Bad Request');
  });

  it('3D.6 should reject TT remittance when SWIFT code is missing (negative test)', async () => {
    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA?.id,
      counterId: registry.masters.counterA1?.id,
      passenger: {
        firstName: 'Ramesh',
        lastName: 'Sharma',
        nationalityType: 'INDIAN',
        pan: testPan,
        passportNumber: testPassport,
      },
      passengerTravel: {
        travellingCountryId: registry.masters.countryId,
      },
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
          quantity: 50000,
          rate: Number(testBookingRate),
          dealCoverId: testDealCoverId,
          issuerPartyProfileId: registry.masters.cardIssuerPartyId,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('TT remittance missing SWIFT code correctly rejected');
  });

  it('3D.7 should reject TT remittance when both account number and IBAN are missing (negative test)', async () => {
    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA?.id,
      counterId: registry.masters.counterA1?.id,
      passenger: {
        firstName: 'Ramesh',
        lastName: 'Sharma',
        nationalityType: 'INDIAN',
        pan: testPan,
        passportNumber: testPassport,
      },
      passengerTravel: {
        travellingCountryId: registry.masters.countryId,
      },
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
          quantity: 50000,
          rate: Number(testBookingRate),
          dealCoverId: testDealCoverId,
          issuerPartyProfileId: registry.masters.cardIssuerPartyId,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('TT remittance missing account/IBAN correctly rejected');
  });

  it('3D.7B should verify TT Remittance transaction payload adheres to frontend form contract (requires dealCoverId, does not require cardId, and CC/CM card items require cardId)', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.currencyUsd?.id).toBeDefined();
    expect(testDealCoverId).toBeDefined();

    // 1. TT item without dealCoverId must be rejected
    const missingDealRes = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA?.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.corporatePartyProfile?.id,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Ramesh',
        lastName: 'Sharma',
        nationalityType: 'INDIAN',
        pan: testPan,
        passportNumber: testPassport,
      },
      passengerTravel: {
        travellingCountryId: registry.masters.countryId,
      },
      ttRemittance: {
        remitterName: 'Ramesh Sharma',
        beneficiaryName: 'Oxford University',
        bankName: 'Barclays Bank',
        swiftCode: 'BARCGB22',
        accountNumber: 'GB29BARC20201531234567',
      },
      items: [
        {
          productId: registry.masters.productTt?.id,
          currencyId: registry.masters.currencyUsd?.id,
          quantity: 50000,
          rate: Number(testBookingRate),
          issuerPartyProfileId: registry.masters.cardIssuerPartyId,
          // dealCoverId omitted
        },
      ],
    });
    expect([400, 422]).toContain(missingDealRes.status);
    const missingDealMsg = Array.isArray(missingDealRes.data?.message)
      ? missingDealRes.data.message.join(' ')
      : (missingDealRes.data?.message || '');
    expect(missingDealMsg.toLowerCase()).toContain('requires a deal cover selection');
    TestLogger.success('TT item without dealCoverId correctly rejected by backend contract');

    // 2. CARD item without cardId must be rejected
    const missingCardRes = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA?.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.cardIssuerPartyId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Ramesh',
        lastName: 'Sharma',
        nationalityType: 'INDIAN',
        pan: testPan,
        passportNumber: testPassport,
      },
      passengerTravel: {
        travellingCountryId: registry.masters.countryId,
      },
      items: [
        {
          productId: registry.masters.productCc?.id,
          currencyId: registry.masters.currencyUsd?.id,
          quantity: 1,
          rate: 85,
          issuerPartyProfileId: registry.masters.cardIssuerPartyId,
          // cardId omitted
        },
      ],
    });
    expect([400, 422]).toContain(missingCardRes.status);
    const missingCardMsg = Array.isArray(missingCardRes.data?.message)
      ? missingCardRes.data.message.join(' ')
      : (missingCardRes.data?.message || '');
    expect(missingCardMsg.toLowerCase()).toContain('requires issuer and card selection');
    TestLogger.success('CARD item without cardId correctly rejected by backend contract');

    TestLogger.success('Verified payload contract: TT requires dealCoverId (never cardId), while CARD requires cardId');
  });

  it('3D.8 should punch complete TT Remittance transaction when details match deal cover exactly', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.currencyUsd?.id).toBeDefined();
    expect(testDealCoverId).toBeDefined();

    const policyRes = await client.get(`/auth/policy-context?branchId=${registry.masters.branchA.id}`);
    const txDate = policyRes.data?.transactionDate || registry.masters.transactionDate || new Date().toISOString().slice(0, 10);

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.corporatePartyProfile?.id,
      tradeMode: 'RETAIL',
      dealCoverId: testDealCoverId,
      passenger: {
        firstName: 'Ramesh',
        lastName: 'Sharma',
        nationalityType: 'INDIAN',
        pan: testPan,
        passportNumber: testPassport,
      },
      passengerTravel: {
        travellingCountryId: registry.masters.countryId,
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
          quantity: 50000,
          rate: Number(testBookingRate),
          dealCoverId: testDealCoverId,
          issuerPartyProfileId: registry.masters.cardIssuerPartyId,
        },
      ],
      payments: [
        {
          paymentMethod: 'BANK_TRANSFER',
          amount: 50000 * Number(testBookingRate),
          accountId: registry.masters.bankAccountId,
          referenceDate: txDate,
        },
      ],
    });

    if (![200, 201].includes(res.status)) {
      TestLogger.warn(`3D.1 deal cover booking failed (${res.status}): ${JSON.stringify(res.data)}`);
    }
    expect([200, 201]).toContain(res.status);
    testTtTransactionId = res.data?.id || res.data?.transaction?.id;
    expect(testTtTransactionId).toBeDefined();

    const getRes = await client.get(`/transactions/${testTtTransactionId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.data).toBeDefined();
    expect(getRes.data.id).toBe(testTtTransactionId);
    expect(getRes.data.items[0]?.dealCoverId).toBe(testDealCoverId);
    TestLogger.success(`Verified GET /transactions/${testTtTransactionId} round-trip (200 OK) for TT Remittance`);

    TestLogger.success('TT Remittance transaction processed successfully');
  });

  it('3D.9 should verify deal cover is locked and marked CONSUMED by approved transaction', async () => {
    expect(testDealCoverId).toBeDefined();
    expect(testTtTransactionId).toBeDefined();

    const res = await client.get(`/deal-covers/${testDealCoverId}`);
    expect(res.status).toBe(200);
    expect(res.data?.consumedTransactionId).toBe(testTtTransactionId);
    expect(res.data?.consumedTransactionItemId).toBeDefined();
    TestLogger.success(`Verified deal cover ${testDealCoverId} marked CONSUMED by transaction ${testTtTransactionId}`);
  });

  it('3D.10 should reject double-dipping when attempting to punch another TT transaction with already consumed deal (negative test)', async () => {
    expect(testDealCoverId).toBeDefined();

    const policyRes = await client.get(`/auth/policy-context?branchId=${registry.masters.branchA.id}`);
    const txDate = policyRes.data?.transactionDate || registry.masters.transactionDate || new Date().toISOString().slice(0, 10);

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.corporatePartyProfile?.id,
      tradeMode: 'RETAIL',
      dealCoverId: testDealCoverId,
      passenger: {
        firstName: 'Ramesh',
        lastName: 'Sharma',
        nationalityType: 'INDIAN',
        pan: testPan,
        passportNumber: testPassport,
      },
      passengerTravel: {
        travellingCountryId: registry.masters.countryId,
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
          quantity: 50000,
          rate: Number(testBookingRate),
          dealCoverId: testDealCoverId,
          issuerPartyProfileId: registry.masters.cardIssuerPartyId,
        },
      ],
      payments: [
        {
          paymentMethod: 'BANK_TRANSFER',
          amount: 50000 * Number(testBookingRate),
          accountId: registry.masters.bankAccountId,
          referenceDate: txDate,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    const msg = Array.isArray(res.data?.message) ? res.data.message.join(' ') : (res.data?.message || '');
    expect(msg.toLowerCase()).toContain('already been consumed');
    TestLogger.success('Double-dipping on consumed deal cover correctly rejected with 400 Bad Request');
  });

  it('3D.11 should query unsettled product settlements queue and locate auto-created TT settlement row', async () => {
    expect(testDealCoverId).toBeDefined();
    expect(registry.masters.cardIssuerPartyId).toBeDefined();
    expect(registry.masters.currencyUsd?.id).toBeDefined();

    const hoBranchId = registry.masters.hoBranch?.id || registry.masters.branchA?.id;

    // In case selling branch is separate from HO, ensure auto-created BRANCH_HO doc is accepted by HO
    await workplaceManager.asHoStaff();
    const branchDocsRes = await client.get('/product-settlements', {
      kind: 'BRANCH_HO',
      status: ['PENDING_HO_ACCEPTANCE'],
      limit: 100,
    });
    const branchDocs = Array.isArray(branchDocsRes.data?.data)
      ? branchDocsRes.data.data
      : (Array.isArray(branchDocsRes.data?.items) ? branchDocsRes.data.items : (Array.isArray(branchDocsRes.data) ? branchDocsRes.data : []));
    for (const doc of branchDocs) {
      await client.post(`/product-settlements/${doc.id}/accept`);
    }

    const res = await client.get('/product-settlements/unsettled', {
      kind: 'HO_ISSUER',
      issuerPartyProfileId: registry.masters.cardIssuerPartyId,
      currencyId: registry.masters.currencyUsd.id,
      hoBranchId,
    });

    expect([200, 304]).toContain(res.status);
    const rows = Array.isArray(res.data?.data)
      ? res.data.data
      : (Array.isArray(res.data?.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []));

    const ttRow = rows.find((r: any) => (testDealCoverId && r.dealCoverId === testDealCoverId) || (testTtTransactionId && r.transactionId === testTtTransactionId));
    expect(ttRow).toBeDefined();
    expect(ttRow.type).toBe('TT');
    expect(Number(ttRow.denomination)).toBe(Number(dealFeAmount));
    expect(ttRow.buyRateSnapshot?.source).toBe('TT_DEAL_RATE');
    testTtSettlementItemId = ttRow.id;
    TestLogger.success(`Located auto-generated TT settlement row: ${testTtSettlementItemId} (source: ${ttRow.buyRateSnapshot?.source})`);
  });

  it('3D.12 should settle TT item with card issuer via Product Settlement Document (TT_SETTLE)', async () => {
    expect(testTtSettlementItemId).toBeDefined();
    expect(registry.masters.cardIssuerPartyId).toBeDefined();
    expect(registry.masters.currencyUsd?.id).toBeDefined();

    const hoBranchId = registry.masters.hoBranch?.id || registry.masters.branchA?.id;

    const policyRes = await client.get(`/auth/policy-context?branchId=${hoBranchId}`);
    const txDate = policyRes.data?.transactionDate || registry.masters.transactionDate || new Date().toISOString().slice(0, 10);

    await workplaceManager.asHoStaff();
    const res = await client.post('/product-settlements', {
      kind: 'HO_ISSUER',
      issuerPartyProfileId: registry.masters.cardIssuerPartyId,
      currencyId: registry.masters.currencyUsd.id,
      hoBranchId,
      transactionDate: txDate,
      reference: `SETTLE_TT_${Date.now().toString().slice(-6)}`,
      remarks: 'TT Outward Remittance Issuer Settlement',
      items: [
        {
          id: testTtSettlementItemId,
          rate: testBookingRate,
        },
      ],
    });

    if (![200, 201].includes(res.status)) {
      TestLogger.warn(`3D.1 deal cover booking failed (${res.status}): ${JSON.stringify(res.data)}`);
    }
    expect([200, 201]).toContain(res.status);
    const docId = res.data?.id;
    expect(docId).toBeDefined();
    TestLogger.success(`Product settlement document created for TT: ${docId} (status: ${res.data?.status})`);

    const docRes = await client.get(`/product-settlements/${docId}`);
    expect(docRes.status).toBe(200);
    const settledItem = docRes.data?.items?.find((i: any) => i.id === testTtSettlementItemId);
    expect(settledItem).toBeDefined();
    expect(settledItem.status).toBe('ISSUER_SETTLED');
    TestLogger.success(`Verified TT settlement item ${testTtSettlementItemId} transitioned to ISSUER_SETTLED`);
  });

  it('3D.13 should verify TT Remittance transaction renders accurately on Sale/Purchase and TT report frontend tables', async () => {
    const spRes = await client.get('/reports/sale-purchase', {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      detail: 'long',
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

  it('3D.14 should return 404 for non-existent deal cover ID without 500 server error', async () => {
    const dummyCoverId = '00000000-0000-0000-0000-000000009999';
    const res = await client.get(`/deal-covers/${dummyCoverId}`);
    expect([404, 400]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Non-existent deal cover returned 404 (no 500 error)');
  });

  it('3D.15 should reject TT remittance when passenger pan is invalid format (negative test)', async () => {
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
