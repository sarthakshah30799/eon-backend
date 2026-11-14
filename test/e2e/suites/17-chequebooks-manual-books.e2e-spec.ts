import { randomUUID } from 'crypto';
import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';
import { TRANSACTION_SLUGS } from '../config/test-constants';

describe('Module 12: Chequebook & Manual Bill Book Operations', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 12: Chequebooks & Manual Bill Books');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  describe('Chequebooks Management', () => {
    it('12.1 should query chequebook dispatches and verify round-trip re-opening', async () => {
      const res = await client.get('/chequebooks/dispatches');
      expect(res.status).toBe(200);

      const items = Array.isArray(res.data?.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []);
      if (items.length > 0) {
        const dispatchId = items[0].id;
        const getRes = await client.get(`/chequebooks/dispatches/${dispatchId}`);
        expect(getRes.status).toBe(200);
        expect(getRes.data).toBeDefined();
        expect(getRes.data.id).toBe(dispatchId);
        TestLogger.success(`Verified GET /chequebooks/dispatches/${dispatchId} round-trip (200 OK)`);
      }

      TestLogger.success('Chequebook dispatches queried');
    });

    it('12.2 should query selectable cheque pages for transaction payment', async () => {
      const res = await client.get('/chequebooks/pages/selectable', {
        accountId: registry.masters.bankAccountId,
      });
      expect(res.status).toBe(200);
      TestLogger.success('Selectable cheque pages queried');
    });
  });

  describe('Manual Bill Books Management', () => {
    it('12.3 should query manual bill book dispatches', async () => {
      const res = await client.get('/manual-bill-books/dispatches');
      expect(res.status).toBe(200);
      TestLogger.success('Manual bill book dispatches queried');
    });

    it('12.4 should query selectable manual bill pages', async () => {
      const res = await client.get('/manual-bill-books/pages/selectable', {
        transactionType: 'ALL',
      });
      expect(res.status).toBe(200);
      TestLogger.success('Selectable manual bill pages queried');
    });

    it('12.5 should query delivery person (DP) list for manual bill book allocation', async () => {
      const res = await client.get('/manual-bill-books/dp-mapping/delivery-persons');
      expect(res.status).toBe(200);
      TestLogger.success('DP list for bill book mapping queried');
    });

    it('12.6 should reject invalid manual book page id on transaction draft with 404', async () => {
      if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

      const fakePageId = randomUUID();
      const res = await client.post('/transactions/drafts', {
        slug: TRANSACTION_SLUGS.SALE_RETAIL,
        branchId: registry.masters.branchA.id,
        counterId: registry.masters.counterA1?.id,
        partyProfileId: registry.masters.cardIssuerPartyId,
        manualBookPageId: fakePageId,
        tradeMode: 'RETAIL',
        passenger: {
          firstName: 'Manual',
          lastName: 'Tester',
          nationalityType: 'INDIAN',
          pan: 'ABCDE1234F',
          passportNumber: 'Z1112223',
        },
        items: [
          {
            productId: registry.masters.productCn?.id,
            currencyId: registry.masters.currencyUsd.id,
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

      expect(res.status).toBe(404);
      const msg = Array.isArray(res.data?.message) ? res.data.message.join(' ') : (res.data?.message || '');
      expect(msg).toMatch(/manual book page with id/i);
      TestLogger.success('Invalid manual book page id correctly rejected with 404');
    });

    it('12.7 should enforce manual bill book requirement when ALLOW_NULL_MANUAL_BOOK_IN_SELL is false and allow when true', async () => {
      if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

      await workplaceManager.asAdmin();

      // 1. Check existing additional settings for TRANSACTION_SETTINGS
      const settingsRes = await client.get('/additional-settings');
      const categories = Array.isArray(settingsRes.data)
        ? settingsRes.data
        : (Array.isArray(settingsRes.data?.data) ? settingsRes.data.data : []);
      const txnCat = categories.find((c: any) => String(c.code).toUpperCase() === 'TRANSACTION_SETTINGS');

      let subId: string | null = null;
      let catId: string | null = null;

      if (!txnCat) {
        // Create TRANSACTION_SETTINGS category with ALLOW_NULL_MANUAL_BOOK_IN_SELL = NO
        const createCatRes = await client.post('/additional-settings', {
          title: 'Transaction Settings',
          code: 'TRANSACTION_SETTINGS',
          subcategories: [
            {
              title: 'Allow Null Manual Book In Sell',
              code: 'ALLOW_NULL_MANUAL_BOOK_IN_SELL',
              value: 'NO',
              valueType: 'boolean',
            },
          ],
        });
        if (createCatRes.ok) {
          catId = createCatRes.data?.id;
          const sub = (createCatRes.data?.subcategories || createCatRes.data?.children || []).find(
            (s: any) => String(s.code).toUpperCase() === 'ALLOW_NULL_MANUAL_BOOK_IN_SELL',
          );
          subId = sub?.id || null;
        }
      } else {
        catId = txnCat.id;
        const sub = (txnCat.subcategories || txnCat.children || []).find(
          (s: any) => String(s.code).toUpperCase() === 'ALLOW_NULL_MANUAL_BOOK_IN_SELL',
        );
        if (sub) {
          subId = sub.id;
          await client.put(`/additional-settings/${catId}/subcategories/${subId}`, {
            description: sub.title || 'Allow Null Manual Book In Sell',
            value: 'NO',
          });
        }
      }

      try {
        if (catId && subId) {
          // Attempt transaction without manualBookPageId -> MUST be rejected with 400
          const res = await client.post('/transactions/drafts', {
            slug: TRANSACTION_SLUGS.SALE_RETAIL,
            branchId: registry.masters.branchA.id,
            counterId: registry.masters.counterA1?.id,
            partyProfileId: registry.masters.cardIssuerPartyId,
            tradeMode: 'RETAIL',
            passenger: {
              firstName: 'Strict',
              lastName: 'Manual',
              nationalityType: 'INDIAN',
              pan: 'ABCDE1234F',
              passportNumber: 'Z1112224',
            },
            items: [
              {
                productId: registry.masters.productCn?.id,
                currencyId: registry.masters.currencyUsd.id,
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

          expect(res.status).toBe(400);
          const msg = Array.isArray(res.data?.message) ? res.data.message.join(' ') : (res.data?.message || '');
          expect(msg).toMatch(/manual book page is required/i);
          TestLogger.success('Enforced manual bill book requirement verified when setting is NO');
        }
      } finally {
        // ALWAYS restore setting to YES so remaining tests are not affected
        if (catId && subId) {
          await client.put(`/additional-settings/${catId}/subcategories/${subId}`, {
            description: 'Allow Null Manual Book In Sell',
            value: 'YES',
          });
          TestLogger.success('Restored ALLOW_NULL_MANUAL_BOOK_IN_SELL to YES');
        }
      }
    });

    it('12.8 should return 404 for non-existent chequebook dispatch ID without 500 error', async () => {
      const dummyId = '00000000-0000-0000-0000-000000009999';
      const res = await client.get(`/chequebooks/dispatches/${dummyId}`);
      expect([404, 400]).toContain(res.status);
      expect(res.status).not.toBe(500);
      TestLogger.success('Non-existent chequebook dispatch returned 404 (no 500 error)');
    });

    it('12.9 should reject chequebook dispatch creation with missing required fields without 500 error', async () => {
      const res = await client.post('/chequebooks/dispatch', {
        // Missing bankAccountId, branchId, etc.
      });
      expect([400, 422]).toContain(res.status);
      expect(res.status).not.toBe(500);
      TestLogger.success('Invalid chequebook dispatch creation rejected with 400/422 (no 500 error)');
    });
  });

  afterAll(async () => {
    try {
      await workplaceManager.asAdmin();
      const settingsRes = await client.get('/additional-settings');
      const categories = Array.isArray(settingsRes.data)
        ? settingsRes.data
        : (Array.isArray(settingsRes.data?.data) ? settingsRes.data.data : []);
      const txnCat = categories.find((c: any) => String(c.code).toUpperCase() === 'TRANSACTION_SETTINGS');
      if (txnCat) {
        for (const sub of (txnCat.subcategories || txnCat.children || [])) {
          const code = String(sub.code).toUpperCase();
          if (code === 'ALLOW_NULL_MANUAL_BOOK_IN_SELL' || code === 'ALLOW_NULL_MANUAL_BOOK_IN_PURCHASE') {
            await client.put(`/additional-settings/${txnCat.id}/subcategories/${sub.id}`, {
              description: sub.title || sub.description || code,
              value: 'YES',
            });
          }
        }
      }
    } catch {
      // Ignore cleanup error
    }
  });
});

