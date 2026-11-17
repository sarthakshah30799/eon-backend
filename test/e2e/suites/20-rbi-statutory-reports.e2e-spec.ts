import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';

describe('Module 15: Statutory RBI Reports (FLM-1 to FLM-8, LRS Daily)', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 15: Statutory RBI Compliance Reports');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  const defaultDateRange = {
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  };

  it('15.1 should fetch FLM-1 Daily Currency Notes Summary with branch filter', async () => {
    const res = await client.get('/reports/flm1-daily-cn-summary', {
      date: '2026-11-12',
      branchIds: registry.masters.branchA?.id ? [registry.masters.branchA.id] : undefined,
    });
    expect(res.status).toBe(200);
    TestLogger.success('FLM-1 Daily Summary retrieved');
  });

  it('15.2 should fetch FLM-3 Purchase of Foreign Currency from Public in branch_wise and consolidate layouts', async () => {
    const res = await client.get('/reports/flm3-purchase-from-public', {
      ...defaultDateRange,
      layout: 'branch_wise',
      view: 'normal',
    });
    expect(res.status).toBe(200);

    const resConsolidated = await client.get('/reports/flm3-purchase-from-public', {
      ...defaultDateRange,
      layout: 'consolidate',
      view: 'extended',
    });
    expect(resConsolidated.status).toBe(200);
    TestLogger.success('FLM-3 Purchase from Public retrieved across branch_wise & consolidate layouts');
  });

  it('15.3 should fetch FLM-4 Purchase of Foreign Currency from FFMC in branch_wise and consolidate layouts', async () => {
    const res = await client.get('/reports/flm4-purchase-from-ffmc', {
      ...defaultDateRange,
      layout: 'branch_wise',
    });
    expect(res.status).toBe(200);

    const resConsolidated = await client.get('/reports/flm4-purchase-from-ffmc', {
      ...defaultDateRange,
      layout: 'consolidate',
    });
    expect(resConsolidated.status).toBe(200);
    TestLogger.success('FLM-4 Purchase from FFMC retrieved across branch_wise & consolidate layouts');
  });

  it('15.4 should fetch FLM-5 Sales of Foreign Currency to Public in branch_wise and consolidate layouts', async () => {
    const res = await client.get('/reports/flm5-sales-to-public', {
      ...defaultDateRange,
      layout: 'branch_wise',
      view: 'normal',
    });
    expect(res.status).toBe(200);

    const resConsolidated = await client.get('/reports/flm5-sales-to-public', {
      ...defaultDateRange,
      layout: 'consolidate',
      view: 'extended',
    });
    expect(resConsolidated.status).toBe(200);
    TestLogger.success('FLM-5 Sales to Public retrieved across branch_wise & consolidate layouts');
  });

  it('15.5 should fetch FLM-6 Sales of Foreign Currency to FFMC in branch_wise and consolidate layouts', async () => {
    const res = await client.get('/reports/flm6-sales-to-ffmc', {
      ...defaultDateRange,
      layout: 'branch_wise',
    });
    expect(res.status).toBe(200);

    const resConsolidated = await client.get('/reports/flm6-sales-to-ffmc', {
      ...defaultDateRange,
      layout: 'consolidate',
    });
    expect(resConsolidated.status).toBe(200);
    TestLogger.success('FLM-6 Sales to FFMC retrieved across branch_wise & consolidate layouts');
  });

  it('15.6 should fetch FLM-8 AD-2 & FLM-8 CN Statement', async () => {
    const ad2Res = await client.get('/reports/flm8-ad2', defaultDateRange);
    expect(ad2Res.status).toBe(200);

    const cnRes = await client.get('/reports/flm8-cn-statement', {
      ...defaultDateRange,
      profileType: 'FFMC',
    });
    expect(cnRes.status).toBe(200);
    TestLogger.success('FLM-8 Statutory Statements retrieved');
  });

  it('15.7 should fetch LRS Daily Outward Monitoring Report', async () => {
    const res = await client.get('/reports/lrs-daily-report', {
      ...defaultDateRange,
      usdRate: 88.0,
    });
    expect(res.status).toBe(200);
    TestLogger.success('LRS Daily Monitoring report retrieved');
  });

  it('15.8 should reject FLM-3 with invalid date format without 500 server error', async () => {
    const res = await client.get('/reports/flm3-purchase-from-public', {
      startDate: 'invalid-date',
      endDate: '2026-12-31',
    });
    expect([400, 422]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Invalid date format in FLM-3 correctly rejected with 400/422 (no 500 error)');
  });

  it('15.9 should reject FLM-1 with invalid branch UUID without 500 server error', async () => {
    const res = await client.get('/reports/flm1-daily-cn-summary', {
      date: '2026-11-12',
      branchIds: ['not-a-uuid'],
    });
    expect([400, 422]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Invalid branch UUID in FLM-1 correctly rejected with 400/422 (no 500 error)');
  });
});

