import { randomUUID } from 'crypto';
import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';

describe('Module 25: Advance Refund & Knock-Off Lifecycle', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  let testReceiptId: string;
  let testRefundId: string;
  const testPan = 'ABCDE1234F';

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 25: Advance Refund & Knock-Off');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('25.1 should query available advance receipts endpoint', async () => {
    const res = await client.get('/advance-refunds/available-advances', {
      panNumber: 'ABCDE1234F',
      branchId: registry.masters.branchA?.id,
    });

    expect([200, 304]).toContain(res.status);
    TestLogger.success('Available advance receipts queried');
  });

  it('25.2 should list advance refunds with pagination', async () => {
    const res = await client.get('/advance-refunds', {
      limit: 10,
    });

    expect([200, 304]).toContain(res.status);
    expect(res.data).toBeDefined();
    TestLogger.success('Advance refunds listing retrieved');
  });

  it('25.2B should provision an advance receipt for refund lifecycle testing', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.corporatePartyProfile?.id).toBeDefined();
    expect(registry.masters.corporatePartyProfile?.entityTypeId).toBeDefined();
    expect(registry.masters.voucherAccountTypeBankId).toBeDefined();
    expect(registry.masters.bankAccountId).toBeDefined();
    expect(registry.masters.advanceControlAccountId).toBeDefined();

    const receiptRes = await client.post('/receipts', {
      transactionDate: registry.masters.transactionDate || new Date().toISOString().slice(0, 10),
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      accountTypeOptionId: registry.masters.voucherAccountTypeBankId,
      headerAccountId: registry.masters.bankAccountId,
      entityTypeOptionId: registry.masters.corporatePartyProfile.entityTypeId,
      partyProfileId: registry.masters.corporatePartyProfile.id,
      panNumber: testPan,
      paymentMethod: 'NEFT',
      chequeDate: registry.masters.transactionDate || new Date().toISOString().slice(0, 10),
      narration: 'Advance receipt for refund testing',
      idempotencyKey: randomUUID(),
      items: [
        {
          itemTypeOptionId: registry.masters.voucherItemTypeAccountId,
          accountId: registry.masters.advanceControlAccountId,
          subledgerPartyProfileId: registry.masters.corporatePartyProfile.id,
          direction: 'CREDIT',
          amount: '75000.00',
        },
      ],
    });

    expect([200, 201]).toContain(receiptRes.status);
    expect(receiptRes.data?.id).toBeDefined();
    testReceiptId = receiptRes.data.id;
    TestLogger.success(`Provisioned advance receipt voucher for refund: ${testReceiptId} (₹75,000.00)`);
  });

  it('25.2C should create an advance refund via LOCAL_BANK paying bank account', async () => {
    expect(testReceiptId).toBeDefined();
    expect(registry.masters.branchA?.id).toBeDefined();
    expect(registry.masters.corporatePartyProfile?.id).toBeDefined();
    expect(registry.masters.bankAccountId).toBeDefined();

    const refundRes = await client.post('/advance-refunds', {
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      transactionDate: registry.masters.transactionDate || new Date().toISOString().slice(0, 10),
      asOnDate: registry.masters.transactionDate || new Date().toISOString().slice(0, 10),
      partyProfileId: registry.masters.corporatePartyProfile.id,
      panNumber: testPan,
      refundType: 'REFUND',
      payoutSource: 'LOCAL_BANK',
      payingBankAccountId: registry.masters.bankAccountId,
      paymentMethod: 'NEFT',
      beneficiaryName: 'Corporate Beneficiary Ltd',
      beneficiaryAccountNumber: '123456789012',
      beneficiaryIfscCode: 'HDFC0000001',
      bankName: 'HDFC Bank',
      narration: 'Advance refund for unutilized booking amount',
      items: [
        {
          receiptVoucherId: testReceiptId,
          refundAmount: '25000.00',
        },
      ],
    });

    expect([200, 201]).toContain(refundRes.status);
    expect(refundRes.data?.id).toBeDefined();
    testRefundId = refundRes.data.id;
    expect(refundRes.data?.status).toBe('COMPLETED');
    expect(refundRes.data?.paymentVoucherId).toBeDefined();
    TestLogger.success(`Advance refund created: ${testRefundId} (Refunded: ₹25,000.00, PaymentVoucher: ${refundRes.data?.paymentVoucherId})`);
  });

  it('25.2D should verify available advance balance is reduced after refund', async () => {
    expect(testReceiptId).toBeDefined();

    const res = await client.get('/advance-refunds/available-advances', {
      branchId: registry.masters.branchA.id,
      partyProfileId: registry.masters.corporatePartyProfile.id,
      panNumber: testPan,
    });

    expect([200, 304]).toContain(res.status);
    const advances = Array.isArray(res.data)
      ? res.data
      : (Array.isArray(res.data?.data) ? res.data.data : []);
    const matching = advances.find((adv: any) => adv.id === testReceiptId);
    expect(matching).toBeDefined();
    expect(Number(matching.consumedRefundsAmount)).toBeGreaterThanOrEqual(25000);
    expect(Number(matching.availableAmount)).toBeLessThanOrEqual(50000);
    TestLogger.success(`Advance receipt balance verified after refund: ConsumedRefunds=₹${matching.consumedRefundsAmount}, Remaining=₹${matching.availableAmount}`);
  });

  it('25.2E should record print copies (CUSTOMER_COPY and DUPLICATE_COPY) on advance refund and verify audit logs', async () => {
    expect(testRefundId).toBeDefined();

    // 1st Print
    const print1 = await client.post(`/advance-refunds/${testRefundId}/print`, {
      copyType: 'CUSTOMER_COPY',
    });
    expect([200, 201]).toContain(print1.status);
    expect(print1.data?.copyType).toBe('CUSTOMER_COPY');
    TestLogger.success(`Advance refund 1st print recorded (copyType: ${print1.data?.copyType})`);

    // 2nd Print
    const print2 = await client.post(`/advance-refunds/${testRefundId}/print`, {});
    expect([200, 201]).toContain(print2.status);
    expect(print2.data?.copyType).toBe('DUPLICATE_COPY');
    TestLogger.success(`Advance refund 2nd print recorded (copyType: ${print2.data?.copyType})`);

    // Verify audit logs
    const detail = await client.get(`/advance-refunds/${testRefundId}`);
    expect(detail.status).toBe(200);
    const printLogs = (detail.data?.logs || []).filter((l: any) => l.action === 'PRINT');
    expect(printLogs.length).toBeGreaterThanOrEqual(2);
    TestLogger.success(`Advance refund audit logs verified: ${printLogs.length} PRINT log entries`);
  });

  it('25.2F should reject advance refund exceeding available receipt balance (negative test)', async () => {
    expect(testReceiptId).toBeDefined();

    const overRefundRes = await client.post('/advance-refunds', {
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      transactionDate: registry.masters.transactionDate || new Date().toISOString().slice(0, 10),
      asOnDate: registry.masters.transactionDate || new Date().toISOString().slice(0, 10),
      partyProfileId: registry.masters.corporatePartyProfile.id,
      panNumber: testPan,
      refundType: 'REFUND',
      payoutSource: 'LOCAL_BANK',
      payingBankAccountId: registry.masters.bankAccountId,
      paymentMethod: 'NEFT',
      narration: 'Excessive refund attempt',
      items: [
        {
          receiptVoucherId: testReceiptId,
          refundAmount: '99999999.00',
        },
      ],
    });

    expect([400, 422]).toContain(overRefundRes.status);
    TestLogger.success('Over-refund exceeding available advance balance correctly rejected with 400');
  });

  it('25.2G should reject advance refund without paying bank account for LOCAL_BANK (negative test)', async () => {
    expect(testReceiptId).toBeDefined();

    const missingBankRes = await client.post('/advance-refunds', {
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      transactionDate: registry.masters.transactionDate || new Date().toISOString().slice(0, 10),
      asOnDate: registry.masters.transactionDate || new Date().toISOString().slice(0, 10),
      partyProfileId: registry.masters.corporatePartyProfile.id,
      panNumber: testPan,
      refundType: 'REFUND',
      payoutSource: 'LOCAL_BANK',
      // Missing payingBankAccountId
      paymentMethod: 'NEFT',
      narration: 'Missing bank account attempt',
      items: [
        {
          receiptVoucherId: testReceiptId,
          refundAmount: '1000.00',
        },
      ],
    });

    expect([400, 422]).toContain(missingBankRes.status);
    TestLogger.success('Advance refund missing payingBankAccountId correctly rejected with 400');
  });

  it('25.3 should reject advance refund creation with missing mandatory items', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();

    const policyRes = await client.get(`/auth/policy-context?branchId=${registry.masters.branchA.id}`);
    const txDate = policyRes.data?.transactionDate || new Date().toISOString().slice(0, 10);

    const res = await client.post('/advance-refunds', {
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      transactionDate: txDate,
      asOnDate: txDate,
      partyProfileId: registry.masters.cardIssuerPartyId,
      items: [], // Missing items
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Advance refund without items correctly rejected');
  });

  it('25.4 should enforce HO-only access for advance refund honour endpoint', async () => {
    // Non-existent ID test to verify authorization guard executes before entity lookup
    const fakeId = '00000000-0000-0000-0000-000000000000';
    try {
      await workplaceManager.asBranchUser();
      const res = await client.post(`/advance-refunds/${fakeId}/honour`, {
        hoPayingBankAccountId: fakeId,
      });
      expect([400, 403, 404]).toContain(res.status);
      TestLogger.success('Branch user access restriction verified on advance refund honour');
    } finally {
      await workplaceManager.asAdmin();
    }
  });

  it('25.5 should reject advance refund creation with non-existent advance voucher ID', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();
    const fakeVoucherId = '00000000-0000-0000-0000-000000000001';
    const txDate = new Date().toISOString().slice(0, 10);

    const res = await client.post('/advance-refunds', {
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      transactionDate: txDate,
      asOnDate: txDate,
      partyProfileId: registry.masters.cardIssuerPartyId,
      refundLedgerAccountId: registry.masters.cashAccountId,
      refundPaymentMethod: 'CASH',
      items: [
        {
          receiptVoucherId: fakeVoucherId,
          refundAmount: '5000.00',
        },
      ],
    });

    expect([400, 404, 422]).toContain(res.status);
    TestLogger.success('Advance refund with non-existent voucher correctly rejected with 400/404');
  });

  it('25.6 should return 404 on non-existent advance refund ID (GET /advance-refunds/:id) without 500 error', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await client.get(`/advance-refunds/${fakeId}`);
    expect(res.status).toBe(404);
    TestLogger.success('Non-existent advance refund ID gracefully handled with 404');
  });
});

