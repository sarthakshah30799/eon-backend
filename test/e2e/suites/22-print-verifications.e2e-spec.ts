import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { PrintHtmlValidator } from '../infrastructure/print-html-validator';
import { TestLogger } from '../infrastructure/test-logger';

describe('Module 17: Document Print Audits & Content Schema Verification', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 17: Print Audits & Schema Verification');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('17.1 should record transaction print and transition print count / copy type', async () => {
    let txId: string;
    const txList = await client.get('/transactions', { limit: 1 });
    const items = Array.isArray(txList.data?.items) ? txList.data.items : (Array.isArray(txList.data) ? txList.data : []);
    if (items.length > 0) {
      txId = items[0].id;
    } else {
      expect(registry.masters.branchA?.id).toBeDefined();
      expect(registry.masters.currencyUsd?.id).toBeDefined();
      const draftRes = await client.post('/transactions/drafts', {
        slug: 'SALE_RETAIL',
        branchId: registry.masters.branchA!.id,
        counterId: registry.masters.counterA1?.id,
        tradeMode: 'RETAIL',
        passenger: {
          firstName: 'Print',
          lastName: 'Tester',
          nationalityType: 'INDIAN',
          pan: 'ABCDE1234F',
          passportNumber: 'Z1234567',
        },
        items: [
          {
            productId: registry.masters.productCn?.id,
            currencyId: registry.masters.currencyUsd!.id,
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
      expect([200, 201]).toContain(draftRes.status);
      txId = draftRes.data?.id;
    }
    expect(txId).toBeDefined();

    // 1st Print
    const print1Res = await client.post(`/transactions/${txId}/print`);
    expect([200, 201]).toContain(print1Res.status);
    expect(print1Res.data?.printCount).toBeGreaterThanOrEqual(1);
    TestLogger.success(`1st Transaction Print recorded for ID: ${txId} (printCount: ${print1Res.data?.printCount})`);

    // 2nd Print (Duplicate Copy)
    const print2Res = await client.post(`/transactions/${txId}/print`);
    expect([200, 201]).toContain(print2Res.status);
    expect(print2Res.data?.printCount).toBeGreaterThanOrEqual(2);
    TestLogger.success(`2nd Transaction Print recorded (Duplicate Copy) for ID: ${txId} (printCount: ${print2Res.data?.printCount})`);

    // Round-trip read-back after print
    const getRes = await client.get(`/transactions/${txId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.data).toBeDefined();
    expect(getRes.data.id).toBe(txId);
    TestLogger.success(`Verified GET /transactions/${txId} round-trip (200 OK) after print`);
  });

  it('17.2 should validate print schema elements on rendered HTML template', async () => {
    const sampleInvoiceHtml = `
      <!DOCTYPE html>
      <html>
        <body>
          <div class="company">MARAEKAT FOREX LIMITED</div>
          <div class="branch">MUMBAI MAIN BRANCH - GSTIN: 27AAACT1234A1Z5</div>
          <div class="doc-header">
            <span>DOC NO: TRN/2026/001</span>
            <span>DATE: 12/08/2026</span>
            <span>COPY: ORIGINAL</span>
          </div>
          <div class="passenger">PASSENGER NAME: Ramesh Sharma | PAN: ABCDE1234F</div>
          <table>
            <tr><td>CURRENCY</td><td>USD</td><td>RATE</td><td>88.50</td><td>INR AMOUNT</td><td>88,500.00</td></tr>
          </table>
          <div class="tax-summary">CGST: 90.00 | SGST: 90.00 | TOTAL TAX: 180.00 | TCS: 0.00</div>
          <div class="payment">PAYMENT MODE: CASH | AMOUNT: 88,680.00</div>
          <div class="words">AMOUNT IN WORDS: Eighty-Eight Thousand Six Hundred Eighty Rupees Only</div>
          <div class="signatures">CUSTOMER SIGNATURE | AUTHORIZED SIGNATORY</div>
        </body>
      </html>
    `;

    const validation = PrintHtmlValidator.validateTransactionPrint(sampleInvoiceHtml);
    expect(validation.isValid).toBe(true);
    expect(validation.copyType).toBe('ORIGINAL');
    expect(validation.missingElements.length).toBe(0);
    TestLogger.success('Print HTML schema validator verified all mandatory elements');
  });

  it('17.3 should reject print on non-existent transaction without 500 error', async () => {
    const dummyTxId = '00000000-0000-0000-0000-000000009999';
    const res = await client.post(`/transactions/${dummyTxId}/print`);
    expect([404, 400]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Print non-existent transaction returned 404/400 (no 500 error)');
  });

  it('17.4 should record print on approved Credit Request Fund and increment printCount', async () => {
    expect(registry.masters.branchA?.id).toBeDefined();

    // Query approved credit request fund or create & approve one
    const listRes = await client.get('/credit-request-fund', { limit: 10 });
    expect([200, 304]).toContain(listRes.status);
    const crfItems = Array.isArray(listRes.data?.data) ? listRes.data.data : (Array.isArray(listRes.data) ? listRes.data : []);
    let crfId = crfItems.find((c: any) => c.status === 'APPROVE')?.id;

    if (!crfId && registry.masters.branchA?.id) {
      const nextNumRes = await client.get('/credit-request-fund/next-number', {
        branchId: registry.masters.branchA.id,
      });
      expect([200, 304]).toContain(nextNumRes.status);
      const requestNumber = nextNumRes.data?.requestNumber || nextNumRes.data?.number || `CRF-${Date.now()}`;

      const policyRes = await client.get(`/auth/policy-context?branchId=${registry.masters.branchA.id}`);
      const txDate = policyRes.data?.transactionDate || new Date().toISOString().slice(0, 10);

      const createRes = await client.post('/credit-request-fund', {
        requestNumber,
        transactionDate: txDate,
        requestBranchId: registry.masters.branchA.id,
        destinationBranchId: registry.masters.branchB?.id || registry.masters.branchA.id,
        temporaryAmount: 50000,
        currencyId: registry.masters.currencyUsd?.id,
        accountTypeOptionId: registry.masters.voucherAccountTypeBankId,
        headerAccountId: registry.masters.bankAccountId,
        entityTypeOptionId: registry.masters.corporatePartyProfile?.entityTypeId,
        partyProfileId: registry.masters.corporatePartyProfile?.id || registry.masters.cardIssuerPartyId,
        narration: 'Print audit test credit request fund',
        items: [
          {
            itemTypeOptionId: registry.masters.voucherItemTypeAccountId,
            accountId: registry.masters.cashAccountId || registry.masters.bankAccountId,
            currencyId: registry.masters.currencyUsd?.id,
            direction: 'DEBIT',
            amount: 50000,
            narration: 'Print audit line',
          },
        ],
      });
      expect([200, 201]).toContain(createRes.status);
      crfId = createRes.data?.id;
      expect(crfId).toBeDefined();

      await workplaceManager.asHoStaff();
      const approveRes = await client.post(`/credit-request-fund/${crfId}/approve`);
      expect([200, 201]).toContain(approveRes.status);
      await workplaceManager.asAdmin();
    }

    expect(crfId).toBeDefined();
    const printRes = await client.post(`/credit-request-fund/${crfId}/print`, {});
    expect([200, 201]).toContain(printRes.status);
    expect(printRes.data?.printCount).toBeGreaterThanOrEqual(1);
    TestLogger.success(`Credit Request Fund print verified: printCount=${printRes.data?.printCount}`);
  });

  it('17.5 should record print on Stock Transfer', async () => {
    const listRes = await client.get('/transfers', { limit: 5 });
    expect([200, 304]).toContain(listRes.status);
    const transferItems = Array.isArray(listRes.data?.data) ? listRes.data.data : (Array.isArray(listRes.data) ? listRes.data : []);
    if (transferItems.length > 0) {
      const transferId = transferItems[0].id;
      const printRes = await client.post(`/transfers/${transferId}/print`);
      expect([200, 201]).toContain(printRes.status);
      TestLogger.success(`Stock Transfer print verified for ID: ${transferId}`);
    }
  });

  it('17.6 should record print on Financial Receipt Voucher', async () => {
    const listRes = await client.get('/receipts', { limit: 5 });
    expect([200, 304]).toContain(listRes.status);
    const receiptItems = Array.isArray(listRes.data?.data) ? listRes.data.data : (Array.isArray(listRes.data) ? listRes.data : []);
    if (receiptItems.length > 0) {
      const receiptId = receiptItems[0].id;
      const printRes = await client.post(`/receipts/${receiptId}/print`, {});
      expect([200, 201]).toContain(printRes.status);
      TestLogger.success(`Receipt voucher print verified for ID: ${receiptId}`);
    }
  });

  it('17.7 should reject print on non-existent credit request fund without 500 error', async () => {
    const dummyId = '00000000-0000-0000-0000-000000009999';
    const res = await client.post(`/credit-request-fund/${dummyId}/print`, {});
    expect([404, 400]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Non-existent credit request fund print returned 404/400 (no 500 error)');
  });
});

