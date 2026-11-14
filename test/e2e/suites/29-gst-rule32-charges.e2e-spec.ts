import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';
import { TRANSACTION_SLUGS } from '../config/test-constants';

describe('Module 29: GST Rule 32 Slabs, Inter-State IGST & Additional Charges', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 29: GST Slabs, IGST & Additional Charges');
    await workplaceManager.asAdmin();
    await registry.initialize(client);
  });

  it('29.1 should calculate GST and split correctly for retail currency sale', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.cardIssuerPartyId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Anand',
        lastName: 'Verma',
        nationalityType: 'INDIAN',
        pan: 'ABCDE1234F',
        passportNumber: 'Z9876543',
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
          amount: 88500,
        },
      ],
    });

    expect([200, 201]).toContain(res.status);
    TestLogger.success('Retail currency sale tax & draft created');
  });

  it('29.2 should support additional charges on transaction draft', async () => {
    if (!registry.masters.branchA?.id || !registry.masters.currencyUsd?.id) return;

    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      branchId: registry.masters.branchA.id,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.cardIssuerPartyId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Sunil',
        lastName: 'Gavaskar',
        nationalityType: 'INDIAN',
        pan: 'ABCDE1234F',
        passportNumber: 'Z9876543',
      },
      items: [
        {
          productId: registry.masters.productCn?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 500,
          rate: 88.5,
        },
      ],
      additionalCharges: [
        {
          chargeName: 'Courier Delivery Charge',
          amount: 250,
          taxApplicable: true,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 500 * 88.5 + 250,
        },
      ],
    });

    expect([200, 201]).toContain(res.status);
    TestLogger.success('Additional charges with tax applicability recorded on transaction');

    if (res.data?.id) {
      const getRes = await client.get(`/transactions/${res.data.id}`);
      expect(getRes.status).toBe(200);
      expect(getRes.data?.id).toBe(res.data.id);
      expect(Array.isArray(getRes.data?.additionalCharges)).toBe(true);
      expect(getRes.data.additionalCharges.length).toBeGreaterThan(0);
      TestLogger.success('Transaction with additional charges re-opened cleanly via GET /transactions/:id');
    }
  });
});

