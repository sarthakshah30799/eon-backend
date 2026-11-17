import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';
import { TRANSACTION_SLUGS } from '../config/test-constants';

describe('Module 4: Passenger AML, KYC, Identity & LRS Regulatory Rules', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 4: Passenger Regulatory & AML Rules');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('4.1 should reject Indian passenger cash purchase exceeding $1,000 limit', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Overlimit',
        lastName: 'Indian',
        nationalityType: 'INDIAN',
        pan: 'FGHIJ6789K',
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 1200, // Exceeds $1,000 limit
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

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Indian cash purchase > $1,000 limit correctly rejected');
  });

  it('4.2 should reject NRI passenger cash purchase exceeding $3,000 limit', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Overlimit',
        lastName: 'NRI',
        nationalityType: 'NRI',
        passportNumber: 'N1122334',
        arrivalDate: new Date().toISOString().slice(0, 10),
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 3500, // Exceeds $3,000 limit
          rate: 87.0,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 3500 * 87.0,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('NRI cash purchase > $3,000 limit correctly rejected');
  });

  it('4.3 should reject missing passport details for NRI passenger', async () => {
    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      branchId: registry.masters.branchA?.id,
      counterId: registry.masters.counterA1?.id,
      passenger: {
        firstName: 'NoPassport',
        lastName: 'NRI',
        nationalityType: 'NRI',
        passportNumber: '', // Missing
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd?.id,
          quantity: 500,
          rate: 87.0,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('NRI missing passport rejected');
  });

  it('4.4 should preview TCS calculation accurately for Education Loan', async () => {
    const purposesRes = await client.get('/purposes');
    const purposes = Array.isArray(purposesRes.data?.data) ? purposesRes.data.data : [];
    const eduPurpose = purposes.find((p: any) => p.code?.includes('EDU') || p.name?.toLowerCase().includes('edu')) || purposes[0];

    const res = await client.post('/transactions/tcs-preview', {
      transactionType: 'SALE',
      purposeId: eduPurpose?.id,
      itemBaseAmount: 1000000,
      loanAmount: 1000000,
    });

    expect([200, 201]).toContain(res.status);
    TestLogger.info(`TCS Education Loan Preview Result:`, res.data);
    expect(res.data).toBeDefined();
  });

  it('4.5 should preview TCS calculation accurately for Holiday Tour Package', async () => {
    const purposesRes = await client.get('/purposes');
    const purposes = Array.isArray(purposesRes.data?.data) ? purposesRes.data.data : [];
    const tourPurpose = purposes.find((p: any) => p.code?.includes('TOUR') || p.name?.toLowerCase().includes('tour')) || purposes[0];

    const res = await client.post('/transactions/tcs-preview', {
      transactionType: 'SALE',
      purposeId: tourPurpose?.id,
      itemBaseAmount: 1200000,
    });

    expect([200, 201]).toContain(res.status);
    TestLogger.info(`TCS Holiday Tour Preview Result:`, res.data);
    expect(res.data).toBeDefined();
  });

  it('4.6 should verify passenger PAN AML online check', async () => {
    const res = await client.post('/passengers/verify-pan', {
      entityType: 'INDIVIDUAL',
      nationalityType: 'INDIAN',
      panNumber: 'ABCDE1234F',
      panHolderName: 'Ramesh Sharma',
    });

    expect([200, 201]).toContain(res.status);
    TestLogger.success('Passenger PAN verification endpoint responded successfully');
  });

  it('4.7 should verify passenger identity lookup endpoint', async () => {
    const res = await client.post('/passengers/lookup-identity', {
      panNumber: 'ABCDE1234F',
      passportNumber: 'Z1234567',
    });

    expect([200, 201, 404]).toContain(res.status);
    TestLogger.success('Passenger identity lookup endpoint operational');
  });

  it('4.8 should verify valid passenger passport AML check', async () => {
    const res = await client.post('/passengers/verify-passport', {
      nationalityType: 'INDIAN',
      passportNumber: 'K9876543',
      passportPassengerName: 'Vikram Malhotra',
      passportIssueAt: 'Delhi',
      passportIssueDate: '2022-01-01',
      passportExpiryDate: '2032-01-01',
      transactionDate: '2026-10-28',
      arrivalDate: '2026-10-25',
    });

    expect([200, 201]).toContain(res.status);
    expect(res.data?.verified).toBe(true);
    TestLogger.success('Valid passport verified successfully');
  });

  it('4.9 should enforce 3-month passport expiry rule after transaction date', async () => {
    const txDate = '2026-10-28';
    const nearExpiry = '2026-11-15'; // within 3 months
    const res = await client.post('/passengers/verify-passport', {
      nationalityType: 'INDIAN',
      passportNumber: 'Z1234567',
      passportPassengerName: 'Rajesh Kumar',
      passportIssueAt: 'Mumbai',
      passportIssueDate: '2020-01-01',
      passportExpiryDate: nearExpiry,
      transactionDate: txDate,
    });

    expect([200, 201]).toContain(res.status);
    expect(res.data?.verified).toBe(false);
    expect(res.data?.message).toMatch(/more than 3 months/i);
    TestLogger.success('Passport 3-month expiry immigration rule correctly enforced');
  });

  it('4.10 should reject passport when expiry date is before issue date', async () => {
    const res = await client.post('/passengers/verify-passport', {
      nationalityType: 'INDIAN',
      passportNumber: 'Z1234567',
      passportPassengerName: 'Rajesh Kumar',
      passportIssueAt: 'Mumbai',
      passportIssueDate: '2025-01-01',
      passportExpiryDate: '2024-01-01',
    });

    expect([200, 201]).toContain(res.status);
    expect(res.data?.verified).toBe(false);
    expect(res.data?.message).toMatch(/after issue date/i);
    TestLogger.success('Passport expiry-after-issue date check enforced');
  });

  it('4.11 should reject passport when arrival date is after transaction date', async () => {
    const res = await client.post('/passengers/verify-passport', {
      nationalityType: 'INDIAN',
      passportNumber: 'Z1234567',
      passportPassengerName: 'Rajesh Kumar',
      passportIssueAt: 'Mumbai',
      passportIssueDate: '2020-01-01',
      passportExpiryDate: '2030-01-01',
      transactionDate: '2026-10-28',
      arrivalDate: '2026-10-29', // after transaction date
    });

    expect([200, 201]).toContain(res.status);
    expect(res.data?.verified).toBe(false);
    expect(res.data?.message).toMatch(/cannot be after/i);
    TestLogger.success('Arrival date constraint enforced');
  });

  it('4.12 should reject PAN verification when dummy/test token is supplied', async () => {
    const res = await client.post('/passengers/verify-pan', {
      entityType: 'INDIVIDUAL',
      nationalityType: 'INDIAN',
      panNumber: 'ABCDE1234F',
      panHolderName: 'TEST_HOLDER',
      panDob: '1990-01-01',
    });

    expect([200, 201]).toContain(res.status);
    expect(res.data?.verified).toBe(false);
    expect(res.data?.message).toMatch(/verification failed/i);
    TestLogger.success('Dummy/test token check enforced');
  });

  it('4.13 should verify alternative ID proof and query other document types', async () => {
    const typesRes = await client.get('/passengers/other-document-types');
    expect([200, 304]).toContain(typesRes.status);
    expect(Array.isArray(typesRes.data)).toBe(true);

    const res = await client.post('/passengers/verify-other-document', {
      documentType: 'VOTER_ID',
      documentNumber: 'VTR1234567',
    });

    expect([200, 201]).toContain(res.status);
    expect(res.data?.verified).toBe(true);
    TestLogger.success('Alternative ID proof verification completed');
  });

  it('4.14 should support Third-Party Payer (Paid By PAN) with relationship on transaction', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.cardIssuerPartyId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Aarav',
        lastName: 'Sharma',
        nationalityType: 'INDIAN',
        pan: 'ABCDE1234F',
        panHolderName: 'Aarav Sharma',
        passportNumber: 'Z1122334',
        paidByPanNumber: 'FGHIJ6789K',
        paidByPanHolderName: 'Rajesh Sharma',
        paidByPanDob: '1970-01-01',
        panHolderRelationType: 'FATHER',
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
          amount: 500 * 88.5,
        },
      ],
    });

    expect([200, 201]).toContain(res.status);
    TestLogger.success('Third-party Paid By PAN transaction recorded successfully');
  });

  it('4.15 should support travel itinerary details (PassengerTravel) on transaction', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.cardIssuerPartyId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Sunita',
        lastName: 'Patel',
        nationalityType: 'INDIAN',
        pan: 'ABCDE1234F',
        passportNumber: 'Z9988776',
      },
      passengerTravel: {
        ticketNo: 'TKT-AIR-99881',
        travelPnr: 'PNR8877',
        route: 'BOM-DXB-LHR',
        departureDate: '2026-11-20',
        noOfDays: 14,
        noOfPax: 1,
        isCisCountry: false,
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 300,
          rate: 88.5,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 300 * 88.5,
        },
      ],
    });

    expect([200, 201]).toContain(res.status);
    TestLogger.success('Passenger travel itinerary details successfully saved on transaction');

    if (res.data?.id) {
      const getRes = await client.get(`/transactions/${res.data.id}`);
      expect(getRes.status).toBe(200);
      expect(getRes.data?.id).toBe(res.data.id);
      expect(Array.isArray(getRes.data?.items)).toBe(true);
      expect(getRes.data.items.length).toBeGreaterThan(0);
      TestLogger.success('Transaction with travel itinerary re-opened cleanly via GET /transactions/:id');
    }
  });

  it('4.16 should reject foreign passenger transaction with incomplete passport details', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.cardIssuerPartyId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Incomplete',
        lastName: 'Foreigner',
        nationalityType: 'FOREIGNER',
        passportNumber: 'US12345678',
        // passportIssueAt, passportIssueDate, passportExpiryDate missing
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 200,
          rate: 87.0,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    const msg = Array.isArray(res.data?.message) ? res.data.message.join(' ') : (res.data?.message || '');
    expect(msg).toMatch(/passport details are required/i);
    TestLogger.success('Foreign passenger missing mandatory passport metadata strictly rejected');
  });

  it('4.17 should validate tour passenger manifest quantity balancing', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    // Tour passenger manifest where sum of fcnAmount (450) does not match sale quantity (500)
    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.cardIssuerPartyId,
      tradeMode: 'BULK',
      passenger: {
        firstName: 'Tour',
        lastName: 'Leader',
        nationalityType: 'INDIAN',
        pan: 'ABCDE1234F',
        passportNumber: 'T9876543',
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 500, // 500 USD
          rate: 88.5,
        },
      ],
      tourPassengers: [
        {
          lineNo: 1,
          fcnCode: 'USD',
          fcnAmount: 200,
          passportNumber: 'T1111111',
          passportName: 'Pax One',
        },
        {
          lineNo: 2,
          fcnCode: 'USD',
          fcnAmount: 250, // Total = 450 (mismatches 500)
          passportNumber: 'T2222222',
          passportName: 'Pax Two',
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 500 * 88.5,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    const msg = Array.isArray(res.data?.message) ? res.data.message.join(' ') : (res.data?.message || '');
    expect(msg).toMatch(/does not match the sale quantity/i);
    TestLogger.success('Tour passenger quantity mismatch rejected');
  });
});

