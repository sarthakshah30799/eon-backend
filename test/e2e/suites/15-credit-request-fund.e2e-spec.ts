import { randomUUID } from 'crypto';
import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';
import { VoucherEntryDirection } from '../../../src/vouchers/voucher.enums';

describe('Module 10: Credit Request Fund & HO Approval Workflow', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  let testCreditReqId: string;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 10: Credit Request Fund');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('10.1 should query next credit request fund number', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();

    const res = await client.get('/credit-request-fund/next-number', {
      branchId: registry.masters.branchA!.id,
    });
    expect([200, 304]).toContain(res.status);
    TestLogger.success('Next credit request number queried');
  });

  it('10.2 should submit a temporary Credit Request Fund in PENDING status', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.branchB?.id).toBeDefined();
    expect(registry.masters.voucherAccountTypeCashId).toBeDefined();
    expect(registry.masters.cashAccountId).toBeDefined();
    expect(registry.masters.corporatePartyProfile?.id).toBeDefined();
    expect(registry.masters.corporatePartyProfile?.entityTypeId).toBeDefined();
    expect(registry.masters.voucherItemTypeAccountId).toBeDefined();
    expect(registry.masters.advanceControlAccountId).toBeDefined();

    const idempotencyKey = `CRF_${randomUUID()}`;
    const res = await client.post('/credit-request-fund', {
      transactionDate: registry.masters.transactionDate || new Date().toISOString().slice(0, 10),
      branchId: registry.masters.branchA!.id,
      counterId: registry.masters.counterA1?.id,
      destinationBranchId: registry.masters.branchB!.id,
      accountTypeOptionId: registry.masters.voucherAccountTypeCashId!,
      headerAccountId: registry.masters.cashAccountId!,
      entityTypeOptionId: registry.masters.corporatePartyProfile!.entityTypeId!,
      partyProfileId: registry.masters.corporatePartyProfile!.id,
      narration: 'Inter-branch credit fund request for corporate bookings',
      idempotencyKey,
      items: [
        {
          itemTypeOptionId: registry.masters.voucherItemTypeAccountId!,
          accountId: registry.masters.advanceControlAccountId || registry.masters.cashAccountId!,
          subledgerPartyProfileId: registry.masters.corporatePartyProfile!.id,
          direction: VoucherEntryDirection.CREDIT,
          amount: '100000.00',
        },
      ],
      paidByPanNumber: 'ABCDE1234F',
      paidByPanName: 'Corporate Representative',
      paidByPanDob: '1985-05-15',
      panHolderRelationOptionId: registry.masters.relationSelfOptionId,
    });

    if (![200, 201].includes(res.status)) {
      TestLogger.warn(`Credit Request Fund creation returned ${res.status}: ${JSON.stringify(res.data)}`);
    }

    // Hard assertion: Any failure (500, 400, etc.) will FAIL the test immediately
    expect([200, 201]).toContain(res.status);
    expect(res.data).toBeDefined();
    expect(res.data?.id).toBeDefined();

    testCreditReqId = res.data.id;
    TestLogger.success(`Credit Request Fund created: ${testCreditReqId} (status: ${res.data?.status})`);
  });

  it('10.3 should approve Credit Request Fund by Head Office staff', async () => {
    expect(testCreditReqId).toBeDefined();

    await workplaceManager.asHoStaff();
    const res = await client.post(`/credit-request-fund/${testCreditReqId}/approve`, {
      transactionDate: registry.masters.transactionDate,
    });
    if (![200, 201].includes(res.status)) {
      TestLogger.warn(`Credit Request Fund approval returned ${res.status}: ${JSON.stringify(res.data)}`);
    }

    expect([200, 201]).toContain(res.status);
    await workplaceManager.asAdmin();
    TestLogger.success(`Credit Request Fund approved: ${testCreditReqId}`);
  });

  it('10.3B should fetch approved credit request fund by ID (GET /credit-request-fund/:id) without 500 error', async () => {
    expect(testCreditReqId).toBeDefined();

    const res = await client.get(`/credit-request-fund/${testCreditReqId}`);
    expect(res.status).toBe(200);
    expect(res.data?.id).toBe(testCreditReqId);
    expect(res.data?.branchId).toBe(registry.masters.branchA?.id);
    TestLogger.success('Credit Request Fund re-opened cleanly via GET /credit-request-fund/:id');
  });

  it('10.3C should record print for approved credit request fund and increment print count', async () => {
    expect(testCreditReqId).toBeDefined();

    const res = await client.post(`/credit-request-fund/${testCreditReqId}/print`, {
      copyType: 'CUSTOMER_COPY',
    });
    if (![200, 201].includes(res.status)) {
      TestLogger.warn(`Credit Request Fund print returned ${res.status}: ${JSON.stringify(res.data)}`);
    }

    expect([200, 201]).toContain(res.status);
    expect(res.data).toBeDefined();
    expect(res.data?.copyType).toBe('CUSTOMER_COPY');
    TestLogger.success(`Credit Request Fund 1st print recorded (copyType: ${res.data?.copyType})`);

    const res2 = await client.post(`/credit-request-fund/${testCreditReqId}/print`, {});
    expect([200, 201]).toContain(res2.status);
    expect(res2.data?.copyType).toBe('DUPLICATE_COPY');
    TestLogger.success(`Credit Request Fund 2nd print recorded (copyType: ${res2.data?.copyType})`);

    const detailRes = await client.get(`/credit-request-fund/${testCreditReqId}`);
    expect(detailRes.status).toBe(200);
    const printLogs = (detailRes.data?.logs || []).filter((l: any) => l.action === 'PRINT');
    expect(printLogs.length).toBeGreaterThanOrEqual(2);
    TestLogger.success(`Credit Request Fund audit logs verified: ${printLogs.length} PRINT log entries`);
  });

  it('10.4 should reject credit request fund with empty items array (negative test)', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();

    const res = await client.post('/credit-request-fund', {
      transactionDate: registry.masters.transactionDate || new Date().toISOString().slice(0, 10),
      branchId: registry.masters.branchA!.id,
      destinationBranchId: registry.masters.branchB!.id,
      accountTypeOptionId: registry.masters.voucherAccountTypeCashId!,
      headerAccountId: registry.masters.cashAccountId!,
      entityTypeOptionId: registry.masters.corporatePartyProfile!.entityTypeId!,
      partyProfileId: registry.masters.corporatePartyProfile!.id,
      narration: 'Empty items negative test',
      idempotencyKey: `CRF_FAIL_${randomUUID()}`,
      items: [],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Credit Request Fund with empty items correctly rejected with 400');
  });

  it('10.5 should submit and approve a Bank / Cheque Credit Request Fund (CHEQUE payment method)', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.branchB?.id).toBeDefined();
    expect(registry.masters.voucherAccountTypeBankId).toBeDefined();
    expect(registry.masters.bankAccountId).toBeDefined();
    expect(registry.masters.corporatePartyProfile?.id).toBeDefined();
    expect(registry.masters.corporatePartyProfile?.entityTypeId).toBeDefined();
    expect(registry.masters.voucherItemTypeAccountId).toBeDefined();

    const idempotencyKey = `CRF_CHQ_${randomUUID()}`;
    const chequeNo = String(Math.floor(100000 + Math.random() * 900000));
    const txDate = registry.masters.transactionDate || new Date().toISOString().slice(0, 10);

    const res = await client.post('/credit-request-fund', {
      transactionDate: txDate,
      branchId: registry.masters.branchA!.id,
      counterId: registry.masters.counterA1?.id,
      destinationBranchId: registry.masters.branchB!.id,
      accountTypeOptionId: registry.masters.voucherAccountTypeBankId!,
      headerAccountId: registry.masters.bankAccountId!,
      entityTypeOptionId: registry.masters.corporatePartyProfile!.entityTypeId!,
      partyProfileId: registry.masters.corporatePartyProfile!.id,
      paymentMethod: 'CHEQUE',
      chequeNumber: chequeNo,
      chequeDate: txDate,
      chequeBranch: 'Fort Branch',
      drawnOn: 'HDFC Bank',
      narration: 'Inter-branch cheque credit fund request for corporate settlement',
      idempotencyKey,
      items: [
        {
          itemTypeOptionId: registry.masters.voucherItemTypeAccountId!,
          accountId: registry.masters.advanceControlAccountId || registry.masters.bankAccountId!,
          subledgerPartyProfileId: registry.masters.corporatePartyProfile!.id,
          direction: VoucherEntryDirection.CREDIT,
          amount: '75000.00',
        },
      ],
      paidByPanNumber: 'ABCDE1234F',
      paidByPanName: 'Corporate Representative',
      paidByPanDob: '1985-05-15',
      panHolderRelationOptionId: registry.masters.relationSelfOptionId,
    });

    if (![200, 201].includes(res.status)) {
      TestLogger.warn(`Cheque Credit Request Fund creation returned ${res.status}: ${JSON.stringify(res.data)}`);
    }

    expect([200, 201]).toContain(res.status);
    expect(res.data?.id).toBeDefined();
    const chqCrfId = res.data.id;
    expect(res.data?.paymentMethod).toBe('CHEQUE');
    expect(res.data?.chequeNumber).toBe(chequeNo);
    TestLogger.success(`Bank / Cheque Credit Request Fund created: ${chqCrfId} (Cheque: ${chequeNo}, DrawnOn: HDFC Bank)`);

    // Approve Cheque CRF by HO staff
    await workplaceManager.asHoStaff();
    const approveRes = await client.post(`/credit-request-fund/${chqCrfId}/approve`, {
      transactionDate: registry.masters.transactionDate,
    });
    expect([200, 201]).toContain(approveRes.status);
    await workplaceManager.asAdmin();
    TestLogger.success(`Bank / Cheque Credit Request Fund approved by HO: ${chqCrfId}`);
  });

  it('10.6 should submit and approve an Electronic Bank Transfer Credit Request Fund (NEFT / BANK_TRANSFER)', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.branchB?.id).toBeDefined();
    expect(registry.masters.voucherAccountTypeBankId).toBeDefined();
    expect(registry.masters.bankAccountId).toBeDefined();
    expect(registry.masters.corporatePartyProfile?.id).toBeDefined();
    expect(registry.masters.corporatePartyProfile?.entityTypeId).toBeDefined();
    expect(registry.masters.voucherItemTypeAccountId).toBeDefined();

    const idempotencyKey = `CRF_NEFT_${randomUUID()}`;
    const txDate = registry.masters.transactionDate || new Date().toISOString().slice(0, 10);

    const res = await client.post('/credit-request-fund', {
      transactionDate: txDate,
      branchId: registry.masters.branchA!.id,
      counterId: registry.masters.counterA1?.id,
      destinationBranchId: registry.masters.branchB!.id,
      accountTypeOptionId: registry.masters.voucherAccountTypeBankId!,
      headerAccountId: registry.masters.bankAccountId!,
      entityTypeOptionId: registry.masters.corporatePartyProfile!.entityTypeId!,
      partyProfileId: registry.masters.corporatePartyProfile!.id,
      paymentMethod: 'NEFT',
      chequeDate: txDate,
      narration: 'Inter-branch electronic NEFT credit fund request for client booking',
      idempotencyKey,
      items: [
        {
          itemTypeOptionId: registry.masters.voucherItemTypeAccountId!,
          accountId: registry.masters.advanceControlAccountId || registry.masters.bankAccountId!,
          subledgerPartyProfileId: registry.masters.corporatePartyProfile!.id,
          direction: VoucherEntryDirection.CREDIT,
          amount: '120000.00',
        },
      ],
      paidByPanNumber: 'ABCDE1234F',
      paidByPanName: 'Corporate Representative',
      paidByPanDob: '1985-05-15',
      panHolderRelationOptionId: registry.masters.relationSelfOptionId,
    });

    if (![200, 201].includes(res.status)) {
      TestLogger.warn(`NEFT Credit Request Fund creation returned ${res.status}: ${JSON.stringify(res.data)}`);
    }

    expect([200, 201]).toContain(res.status);
    expect(res.data?.id).toBeDefined();
    const neftCrfId = res.data.id;
    expect(res.data?.paymentMethod).toBe('NEFT');
    TestLogger.success(`Electronic Bank Transfer (NEFT) Credit Request Fund created: ${neftCrfId}`);

    // Approve NEFT CRF by HO staff
    await workplaceManager.asHoStaff();
    const approveRes = await client.post(`/credit-request-fund/${neftCrfId}/approve`, {
      transactionDate: registry.masters.transactionDate,
    });
    expect([200, 201]).toContain(approveRes.status);
    await workplaceManager.asAdmin();
    TestLogger.success(`Electronic Bank Transfer Credit Request Fund approved by HO: ${neftCrfId}`);
  });

  it('10.7 should reject Cheque CRF when mandatory cheque details are missing (negative test)', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.branchB?.id).toBeDefined();
    expect(registry.masters.voucherAccountTypeBankId).toBeDefined();
    expect(registry.masters.bankAccountId).toBeDefined();
    expect(registry.masters.corporatePartyProfile?.id).toBeDefined();

    const res = await client.post('/credit-request-fund', {
      transactionDate: registry.masters.transactionDate || new Date().toISOString().slice(0, 10),
      branchId: registry.masters.branchA!.id,
      counterId: registry.masters.counterA1?.id,
      destinationBranchId: registry.masters.branchB!.id,
      accountTypeOptionId: registry.masters.voucherAccountTypeBankId!,
      headerAccountId: registry.masters.bankAccountId!,
      entityTypeOptionId: registry.masters.corporatePartyProfile!.entityTypeId!,
      partyProfileId: registry.masters.corporatePartyProfile!.id,
      paymentMethod: 'CHEQUE',
      // Missing chequeNumber, chequeDate, chequeBranch, drawnOn
      narration: 'Cheque without details negative test',
      idempotencyKey: `CRF_CHQ_FAIL_${randomUUID()}`,
      items: [
        {
          itemTypeOptionId: registry.masters.voucherItemTypeAccountId!,
          accountId: registry.masters.advanceControlAccountId || registry.masters.bankAccountId!,
          subledgerPartyProfileId: registry.masters.corporatePartyProfile!.id,
          direction: VoucherEntryDirection.CREDIT,
          amount: '50000.00',
        },
      ],
      paidByPanNumber: 'ABCDE1234F',
      paidByPanName: 'Corporate Representative',
      paidByPanDob: '1985-05-15',
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Cheque CRF with missing cheque details correctly rejected with 400');
  });
});
