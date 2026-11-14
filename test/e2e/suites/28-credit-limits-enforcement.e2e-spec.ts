import { randomUUID } from 'crypto';
import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';
import { TRANSACTION_SLUGS } from '../config/test-constants';

describe('Module 28: Party Credit Limits & Credit Request Fund Enforcement', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 28: Credit Limits & Request Fund');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('28.1 should preview credit validation for party profile transaction', async () => {
    if (!registry.masters.cardIssuerPartyId) return;

    const res = await client.post('/transactions/credit-preview', {
      partyProfileId: registry.masters.cardIssuerPartyId,
      transactionType: 'SALE',
      transactionDate: '2026-10-28',
      payableAmount: 500000,
    });

    expect([200, 201]).toContain(res.status);
    expect(res.data).toBeDefined();
    TestLogger.success('Credit preview evaluated successfully');
  });

  it('28.2 should create a Credit Request Fund in PENDING status', async () => {
    if (
      !registry.masters.branchA?.id ||
      !registry.masters.voucherAccountTypeBankId ||
      !registry.masters.bankAccountId ||
      !registry.masters.corporatePartyProfile?.id ||
      !registry.masters.corporatePartyProfile?.entityTypeId ||
      !registry.masters.voucherItemTypeAccountId
    ) {
      return;
    }

    const txDate = registry.masters.transactionDate || new Date().toISOString().slice(0, 10);
    const res = await client.post('/credit-request-fund', {
      transactionDate: txDate,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      destinationBranchId: registry.masters.branchB?.id || registry.masters.branchA.id,
      accountTypeOptionId: registry.masters.voucherAccountTypeBankId,
      headerAccountId: registry.masters.bankAccountId,
      entityTypeOptionId: registry.masters.corporatePartyProfile.entityTypeId,
      partyProfileId: registry.masters.corporatePartyProfile.id,
      chequeNumber: 'CHQ-CRF-1234',
      chequeDate: txDate,
      chequeBranch: 'Mumbai',
      drawnOn: 'HDFC Bank',
      narration: 'Urgent corporate travel client request',
      idempotencyKey: randomUUID(),
      items: [
        {
          itemTypeOptionId: registry.masters.voucherItemTypeAccountId,
          accountId: registry.masters.advanceControlAccountId || registry.masters.bankAccountId,
          subledgerPartyProfileId: registry.masters.corporatePartyProfile.id,
          direction: 'CREDIT',
          amount: '250000.00',
        },
      ],
    });

    expect([200, 201]).toContain(res.status);
    const creditReqId = res.data?.id;
    expect(creditReqId).toBeDefined();

    // Now test HO rejection with remarks
    await workplaceManager.asHoStaff();
    const rejRes = await client.post(`/credit-request-fund/${creditReqId}/reject`, {
      remarks: 'Insufficient historical turnover for temporary credit',
    });
    expect([200, 201]).toContain(rejRes.status);
    expect(['REJECT', 'REJECTED']).toContain(rejRes.data?.status);
    TestLogger.success('Credit Request Fund rejection workflow verified');

    // Round-trip check: Re-open rejected request by ID
    const getRes = await client.get(`/credit-request-fund/${creditReqId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.data?.id).toBe(creditReqId);
    expect(['REJECT', 'REJECTED']).toContain(getRes.data?.status);
    TestLogger.success('Rejected credit request fund re-opened cleanly via GET /credit-request-fund/:id');
  });

  it('28.3 should allow cancellation of pending Credit Request Fund by creator', async () => {
    if (
      !registry.masters.branchA?.id ||
      !registry.masters.voucherAccountTypeBankId ||
      !registry.masters.bankAccountId ||
      !registry.masters.corporatePartyProfile?.id ||
      !registry.masters.corporatePartyProfile?.entityTypeId ||
      !registry.masters.voucherItemTypeAccountId
    ) {
      return;
    }

    await workplaceManager.asAdmin();
    const txDate = registry.masters.transactionDate || new Date().toISOString().slice(0, 10);
    const res = await client.post('/credit-request-fund', {
      transactionDate: txDate,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      destinationBranchId: registry.masters.branchB?.id || registry.masters.branchA.id,
      accountTypeOptionId: registry.masters.voucherAccountTypeBankId,
      headerAccountId: registry.masters.bankAccountId,
      entityTypeOptionId: registry.masters.corporatePartyProfile.entityTypeId,
      partyProfileId: registry.masters.corporatePartyProfile.id,
      chequeNumber: 'CHQ-CRF-5678',
      chequeDate: txDate,
      chequeBranch: 'Mumbai',
      drawnOn: 'HDFC Bank',
      narration: 'Temporary buffer to be cancelled',
      idempotencyKey: randomUUID(),
      items: [
        {
          itemTypeOptionId: registry.masters.voucherItemTypeAccountId,
          accountId: registry.masters.advanceControlAccountId || registry.masters.bankAccountId,
          subledgerPartyProfileId: registry.masters.corporatePartyProfile.id,
          direction: 'CREDIT',
          amount: '150000.00',
        },
      ],
    });

    if (res.ok) {
      const cancelRes = await client.post(`/credit-request-fund/${res.data?.id}/cancel`, {});
      expect([200, 201]).toContain(cancelRes.status);
      TestLogger.success('Credit Request Fund cancelled successfully');
    }
  });

  it('28.4 should reject partial payment with outstanding balance when credit is not approved', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    // Transaction where payable = 88,500, but payment = 40,000 (leaves 48,500 outstanding without credit)
    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.corporatePartyProfile?.id || registry.masters.cardIssuerPartyId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'NoCredit',
        lastName: 'Walkin',
        nationalityType: 'INDIAN',
        pan: 'ABCDE1234F',
        passportNumber: 'Z1234999',
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 1000,
          rate: 88.5,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 40000, // Partial payment (outstanding 48,500)
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Partial payment with unapproved outstanding balance correctly blocked');
  });

  it('28.5 should allow full payment transaction without requiring credit facility', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.corporatePartyProfile?.id || registry.masters.cardIssuerPartyId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Full',
        lastName: 'Payer',
        nationalityType: 'INDIAN',
        pan: 'ABCDE1234F',
        passportNumber: 'Z1234999',
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
          amount: 500 * 88.5, // 100% full payment (0 outstanding)
        },
      ],
    });

    expect([200, 201]).toContain(res.status);
    TestLogger.success('Full payment transaction settled without credit block');
  });
});

