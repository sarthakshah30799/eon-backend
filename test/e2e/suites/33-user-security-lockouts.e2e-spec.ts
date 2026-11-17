import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';

describe('Module 33: User Security, Active Sessions & Authentication Controls', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 33: Security & Session Policies');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('33.1 should reject authentication with incorrect credentials', async () => {
    const wrongClient = new ApiClient();
    const loginRes = await wrongClient.login('nonexistent_user_9999@maraekat.com', 'IncorrectPassword123!', 'Wrong Login Test');
    expect(loginRes.ok).toBe(false);
    expect([400, 401]).toContain(loginRes.status);
    TestLogger.success('Invalid login attempt correctly rejected by auth guard');
  });

  it('33.2 should query authentication status endpoint (/auth/check)', async () => {
    const res = await client.get('/auth/check');
    expect(res.status).toBe(200);
    expect(res.data?.authenticated).toBe(true);
    expect(res.data?.isAdmin).toBe(true);
    TestLogger.success('Session status verified via /auth/check');
  });

  it('33.3 should query active sessions list for authenticated user', async () => {
    const res = await client.get('/auth/sessions');
    expect([200, 304]).toContain(res.status);
    expect(Array.isArray(res.data)).toBe(true);
    TestLogger.success('Active user sessions retrieved');
  });

  it('33.4 should block unauthenticated access to protected session endpoints', async () => {
    const unauthClient = new ApiClient(); // no login
    const res = await unauthClient.get('/auth/sessions');
    expect([401, 403]).toContain(res.status);
    TestLogger.success('Unauthenticated request to /auth/sessions blocked');
  });

  it('33.5 should reject login with empty payload without 500 server error', async () => {
    const unauthClient = new ApiClient();
    const res = await unauthClient.post('/auth/login', {});
    expect([400, 401, 422]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Empty login payload rejected with 400/401 (no 500 error)');
  });

  it('33.6 should return 404/400 for non-existent user profile query without 500 error', async () => {
    const dummyUserId = '00000000-0000-0000-0000-000000009999';
    const res = await client.get(`/users/${dummyUserId}`);
    expect([404, 400]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Non-existent user query returned 404/400 (no 500 error)');
  });
});

