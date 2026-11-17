import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';
import { TRANSACTION_SLUGS } from '../config/test-constants';

describe('Module 2: Party Profiles Lifecycle, Approvals & Limits (All Client Types)', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  let testCorporatePartyId: string;
  let testFfmcPartyId: string;
  let testRejectedPartyId: string;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 2: Party Profiles Lifecycle');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('2.1 should create a new Corporate Client party profile in PENDING status', async () => {
    if (!registry.masters.branchA?.id) return;
    const timestamp = Date.now().toString().slice(-6);
    const code = `CORP_${timestamp}`;

    const res = await client.post('/party-profiles', {
      type: 'CORPORATE_CLIENT',
      code,
      name: `Corporate Test Client ${timestamp}`,
      address1: '123 Corporate Park',
      city: 'Mumbai',
      pinCode: '400021',
      branchIds: [registry.masters.branchA.id],
      panNo: `AAACT${timestamp.slice(0, 4)}A`,
      creditLimit: 500000,
      creditDays: 30,
      permanentCreditLimit: 500000,
      permanentCreditDays: 30,
    });

    expect([201, 200]).toContain(res.status);
    testCorporatePartyId = res.data?.id;
    expect(testCorporatePartyId).toBeDefined();
    expect(res.data?.status).toBe('PENDING');

    const getRes = await client.get(`/party-profiles/${testCorporatePartyId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.data).toBeDefined();
    expect(getRes.data.id).toBe(testCorporatePartyId);
    TestLogger.success(`Verified GET /party-profiles/${testCorporatePartyId} round-trip (200 OK)`);

    TestLogger.success(`Corporate party profile created: ${code} (${testCorporatePartyId})`);
  });

  it('2.2 should create a new FFMC party profile', async () => {
    if (!registry.masters.branchA?.id) return;
    const timestamp = Date.now().toString().slice(-6);
    const code = `FFMC_${timestamp}`;

    const res = await client.post('/party-profiles', {
      type: 'FFMC',
      code,
      name: `FFMC Test Changer ${timestamp}`,
      address1: '456 Exchange Road',
      city: 'Mumbai',
      pinCode: '400001',
      branchIds: [registry.masters.branchA.id],
      ffmcRegNo: `FFMC-REG-${timestamp}`,
      ffmcRegDate: '2024-01-01',
      chqTrxnLimit: 1000000,
    });

    expect([201, 200]).toContain(res.status);
    testFfmcPartyId = res.data?.id;
    expect(testFfmcPartyId).toBeDefined();

    const getRes = await client.get(`/party-profiles/${testFfmcPartyId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.data).toBeDefined();
    expect(getRes.data.id).toBe(testFfmcPartyId);
    TestLogger.success(`Verified GET /party-profiles/${testFfmcPartyId} round-trip (200 OK)`);

    TestLogger.success(`FFMC party profile created: ${code} (${testFfmcPartyId})`);
  });

  it('2.3 should reject duplicate party profile code', async () => {
    if (!registry.masters.branchA?.id) return;
    // Attempting to create again with duplicate code
    const res = await client.post('/party-profiles', {
      type: 'CORPORATE_CLIENT',
      code: 'CORP_DUPLICATE_TEST',
      name: 'Duplicate 1',
      address1: '789 Business Ave',
      city: 'Mumbai',
      pinCode: '400051',
      branchIds: [registry.masters.branchA.id],
    });
    if (res.ok) {
      const resDup = await client.post('/party-profiles', {
        type: 'CORPORATE_CLIENT',
        code: 'CORP_DUPLICATE_TEST',
        name: 'Duplicate 2',
        address1: '789 Business Ave',
        city: 'Mumbai',
        pinCode: '400051',
        branchIds: [registry.masters.branchA.id],
      });
      expect([400, 409]).toContain(resDup.status);
      TestLogger.success('Duplicate party code rejected');
    }
  });

  it('2.4 should approve party profile by Head Office (HO)', async () => {
    if (!testCorporatePartyId) return;

    await workplaceManager.asHoStaff();
    const res = await client.post(`/party-profiles/${testCorporatePartyId}/review`, {
      status: 'APPROVE',
      active: true,
    });

    expect([200, 201]).toContain(res.status);
    expect(res.data?.status).toBe('APPROVE');
    TestLogger.success(`Party profile approved: ${testCorporatePartyId}`);
  });

  it('2.5 should reject a party profile by HO and verify transaction block', async () => {
    if (!registry.masters.branchA?.id) return;
    const timestamp = Date.now().toString().slice(-6);
    await workplaceManager.asAdmin();
    const createRes = await client.post('/party-profiles', {
      type: 'RMC',
      code: `REJ_${timestamp}`,
      name: `To Be Rejected ${timestamp}`,
      address1: '101 Trade Center',
      city: 'Delhi',
      pinCode: '110001',
      branchIds: [registry.masters.branchA.id],
    });

    if (createRes.ok) {
      testRejectedPartyId = createRes.data?.id;

      await workplaceManager.asHoStaff();
      const rejRes = await client.post(`/party-profiles/${testRejectedPartyId}/review`, {
        status: 'REJECT',
        active: false,
        rejectReason: 'Incomplete KYC documentation',
      });
      expect([200, 201]).toContain(rejRes.status);
      expect(rejRes.data?.status).toBe('REJECT');

      // Now verify transaction punching is blocked for rejected party
      const txRes = await client.post('/transactions/drafts', {
        slug: TRANSACTION_SLUGS.SALE_BULK_FFMC,
        partyProfileId: testRejectedPartyId,
        branchId: registry.masters.branchA?.id,
        items: [
          {
            productId: registry.masters.productCn?.id,
            currencyId: registry.masters.currencyUsd?.id,
            quantity: 500,
            rate: 88.5,
          },
        ],
      });

      expect([400, 422]).toContain(txRes.status);
      TestLogger.success('Transaction blocked for REJECTED party profile');
    }
  });

  it('2.6 should block transaction when party profile is marked inactive', async () => {
    if (!testFfmcPartyId) return;

    await workplaceManager.asAdmin();
    await client.put(`/party-profiles/${testFfmcPartyId}`, {
      active: false,
      isActive: false,
    });

    const txRes = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_BULK_FFMC,
      partyProfileId: testFfmcPartyId,
      branchId: registry.masters.branchA?.id,
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd?.id,
          quantity: 200,
          rate: 88.5,
        },
      ],
    });

    expect([400, 422]).toContain(txRes.status);
    TestLogger.success('Transaction blocked for INACTIVE party profile');
  });

  it('2.7 should return 404 for non-existent party profile ID without 500 server error', async () => {
    const dummyId = '00000000-0000-0000-0000-000000009999';
    const res = await client.get(`/party-profiles/${dummyId}`);
    expect([404, 400]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Non-existent party profile returned 404 (no 500 error)');
  });

  it('2.8 should reject party profile creation with invalid type without 500 error', async () => {
    const res = await client.post('/party-profiles', {
      type: 'INVALID_PROFILE_TYPE',
      code: 'INVALID_CODE_99',
      name: 'Invalid Profile',
    });
    expect([400, 422]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Invalid party profile type rejected with 400/422 (no 500 error)');
  });
});

