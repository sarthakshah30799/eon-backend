import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';

describe('Module 11: Bank Reconciliation, Cheque In-Transit & Dishonour (Bounce) Postings', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 11: Bank Reconciliation & Dishonour');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  const defaultDateRange = {
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  };

  it('11.1 should query bank reconciliation uncleared cheque entries', async () => {
    if (!registry.masters.bankAccountId) return;

    const res = await client.get('/bank-reconciliation', {
      bankAccountId: registry.masters.bankAccountId,
      ...defaultDateRange,
    });

    expect(res.status).toBe(200);
    TestLogger.success('Queried bank reconciliation rows');
  });

  it('11.2 should clear a cheque entry with bank realization date when items exist', async () => {
    if (!registry.masters.bankAccountId) return;

    const res = await client.get('/bank-reconciliation', {
      bankAccountId: registry.masters.bankAccountId,
      ...defaultDateRange,
    });

    const items = [
      ...(res.data?.receivedNotDeposited || []),
      ...(res.data?.issuedNotPresented || []),
    ];
    if (items.length > 0) {
      const target = items[0];
      const clearRes = await client.post('/bank-reconciliation/clear', {
        items: [
          {
            sourceType: target.sourceType || 'TRANSACTION_PAYMENT',
            sourceId: target.sourceId || target.id,
            bankDate: new Date().toISOString().slice(0, 10),
            isDishonored: false,
            reconciliationRemarks: 'Cleared in bank statement',
          },
        ],
      });

      expect([200, 201]).toContain(clearRes.status);
      TestLogger.success(`Bank cheque row cleared successfully`);
    } else {
      TestLogger.info('No uncleared cheques found in transit');
    }
  });

  it('11.3 should reject clearing bank reconciliation with non-existent sourceId without 500 error', async () => {
    const dummySourceId = '00000000-0000-0000-0000-000000009999';
    const clearRes = await client.post('/bank-reconciliation/clear', {
      items: [
        {
          sourceType: 'TRANSACTION_PAYMENT',
          sourceId: dummySourceId,
          bankDate: new Date().toISOString().slice(0, 10),
          isDishonored: false,
          reconciliationRemarks: 'Cleared dummy test',
        },
      ],
    });
    expect([400, 404, 422]).toContain(clearRes.status);
    expect(clearRes.status).not.toBe(500);
    TestLogger.success('Clear bank reconciliation with non-existent sourceId returned 400/404 (no 500 error)');
  });

  it('11.4 should reject querying bank reconciliation with invalid bankAccountId without 500 error', async () => {
    const res = await client.get('/bank-reconciliation', {
      bankAccountId: 'not-a-valid-uuid',
      ...defaultDateRange,
    });
    expect([400, 422]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Bank reconciliation query with invalid bankAccountId rejected with 400/422 (no 500 error)');
  });
});

