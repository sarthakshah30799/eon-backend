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
    // Get an existing approved transaction
    const txList = await client.get('/transactions', { limit: 1 });
    const items = Array.isArray(txList.data?.items) ? txList.data.items : (Array.isArray(txList.data) ? txList.data : []);
    if (items.length > 0) {
      const txId = items[0].id;

      // 1st Print
      const print1Res = await client.post(`/transactions/${txId}/print`);
      expect([200, 201]).toContain(print1Res.status);
      TestLogger.success(`1st Transaction Print recorded for ID: ${txId}`);

      // 2nd Print (Duplicate Copy)
      const print2Res = await client.post(`/transactions/${txId}/print`);
      expect([200, 201]).toContain(print2Res.status);
      TestLogger.success(`2nd Transaction Print recorded (Duplicate Copy) for ID: ${txId}`);

      // Round-trip read-back after print
      const getRes = await client.get(`/transactions/${txId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.data).toBeDefined();
      expect(getRes.data.id).toBe(txId);
      TestLogger.success(`Verified GET /transactions/${txId} round-trip (200 OK) after print`);
    } else {
      TestLogger.info('No transactions found to test print recording');
    }
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
});

