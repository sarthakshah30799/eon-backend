import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';

describe('Module 31: Bank Cheque Dishonour & Reconciliation State Machine', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 31: Bank Cheque Dishonour & Reconciliation');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('31.1 should query bank reconciliation cheques', async () => {
    const res = await client.get('/bank-reconciliation', {
      bankAccountId: registry.masters.bankAccountId,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });

    expect([200, 304]).toContain(res.status);
    TestLogger.success('Uncleared cheques queried from bank reconciliation');
  });

  it('31.2 should validate dishonour requires reversalNumber', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await client.post('/bank-reconciliation/clear', {
      items: [
        {
          sourceType: 'TRANSACTION_PAYMENT',
          sourceId: fakeId,
          bankDate: '2026-10-28',
          isDishonored: true,
          // reversalNumber missing
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Dishonour without mandatory reversal number correctly rejected');
  });

  it('31.3 should reject bank reconciliation clear with empty items', async () => {
    const res = await client.post('/bank-reconciliation/clear', {
      items: [],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Bank reconciliation clear with empty items rejected');
  });

  it('31.4 should reject bank reconciliation clear with invalid sourceType without 500 error', async () => {
    const res = await client.post('/bank-reconciliation/clear', {
      items: [
        {
          sourceType: 'INVALID_SOURCE_TYPE',
          sourceId: '00000000-0000-0000-0000-000000000000',
          bankDate: '2026-10-28',
          isDishonored: false,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Invalid sourceType in bank reconciliation clear rejected with 400/422 (no 500 error)');
  });

  it('31.5 should reject bank reconciliation query with invalid date format without 500 error', async () => {
    const res = await client.get('/bank-reconciliation', {
      bankAccountId: registry.masters.bankAccountId,
      startDate: 'invalid-date',
      endDate: '2026-12-31',
    });

    expect([400, 422]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Invalid date format in bank reconciliation query rejected with 400/422 (no 500 error)');
  });
});

