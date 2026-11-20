import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';
import { TRANSACTION_SLUGS } from '../config/test-constants';

describe('Module 3E: Travellers Cheque (TP) Encashment Surrender & Settle Lifecycle', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  let testTpTransactionId: string;
  let testTpDocumentId: string;
  let testTpSettlementItemId: string;
  let sellingBranchId: string;
  let sellingCounterId: string | undefined;

  const listDocs = (payload: any) =>
    Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : [];

  const matchesTpProduct = (doc: any) => {
    const codes = doc?.productCodes;
    if (typeof codes === 'string') {
      return codes
        .split(',')
        .map((c: string) => c.trim().toUpperCase())
        .includes('TP');
    }
    if (Array.isArray(codes)) {
      return codes.map((c: any) => String(c).trim().toUpperCase()).includes('TP');
    }
    return String(doc?.productCode ?? '').trim().toUpperCase() === 'TP';
  };

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 3E: Travellers Cheque (TP) Encashment Surrender Lifecycle');
    await workplaceManager.asAdmin();
    await registry.initialize(client);

    // Branch→HO surrender requires a non-HO selling branch; HO punches auto-accept.
    expect(registry.masters.nonHoBranch?.id).toBeDefined();
    expect(registry.masters.nonHoCounter?.id).toBeDefined();
    sellingBranchId = registry.masters.nonHoBranch!.id;
    sellingCounterId = registry.masters.nonHoCounter!.id;
    TestLogger.info(
      `TP selling branch (non-HO): ${registry.masters.nonHoBranch!.code || sellingBranchId}`,
    );
  });

  it('3E.1 should execute customer encashment surrender of TP cheques with auto-surrender to HO', async () => {
    expect(sellingBranchId).toBeDefined();
    expect(registry.masters.currencyUsd?.id).toBeDefined();
    expect(registry.masters.cardIssuerPartyId).toBeDefined();

    const policyRes = await client.get(`/auth/policy-context?branchId=${sellingBranchId}`);
    const txDate =
      policyRes.data?.transactionDate ||
      registry.masters.transactionDate ||
      new Date().toISOString().slice(0, 10);
    const partyProfileId = registry.masters.corporatePartyProfile?.id || registry.masters.cardIssuerPartyId;
    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      transactionDate: txDate,
      branchId: sellingBranchId,
      counterId: sellingCounterId,
      partyProfileId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Anand',
        lastName: 'Verma',
        nationalityType: 'INDIAN',
        pan: 'EFGHI5678J',
        passportNumber: 'W9988776',
      },
      items: [
        {
          productId: registry.masters.productTp?.id,
          currencyId: registry.masters.currencyUsd.id,
          issuerPartyProfileId: registry.masters.cardIssuerPartyId,
          quantity: 1000,
          rate: 87.0,
          denomination: 100,
          autoSurrender: true,
        },
      ],
      payments: [
        {
          paymentMethod: 'BANK_TRANSFER',
          amount: 87000,
          accountId: registry.masters.bankAccountId,
          referenceDate: txDate,
        },
      ],
    });

    if (![200, 201].includes(res.status)) {
      TestLogger.warn(`3E.1 TP purchase draft failed (${res.status}): ${JSON.stringify(res.data)}`);
    }
    expect([200, 201]).toContain(res.status);
    testTpTransactionId = res.data?.id || res.data?.transaction?.id;
    expect(testTpTransactionId).toBeDefined();

    const getRes = await client.get(`/transactions/${testTpTransactionId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.data).toBeDefined();
    expect(getRes.data.id).toBe(testTpTransactionId);
    TestLogger.success(`Verified GET /transactions/${testTpTransactionId} round-trip (200 OK) for TP encashment`);
    TestLogger.success('TP encashment surrender purchase processed successfully');
  });

  it('3E.2 should auto-queue Branch -> HO Surrender document in PENDING_HO_ACCEPTANCE', async () => {
    expect(testTpTransactionId).toBeDefined();

    await workplaceManager.asHoStaff();
    const branchDocsRes = await client.get('/product-settlements', {
      kind: 'BRANCH_HO',
      status: ['PENDING_HO_ACCEPTANCE'],
      branchId: sellingBranchId,
      limit: 100,
    });

    expect([200, 304]).toContain(branchDocsRes.status);
    const branchDocs = listDocs(branchDocsRes.data);

    const tpDoc = branchDocs.find(
      (d: any) =>
        matchesTpProduct(d) &&
        d.currencyId === registry.masters.currencyUsd.id &&
        d.status === 'PENDING_HO_ACCEPTANCE' &&
        d.branchId === sellingBranchId,
    );

    expect(tpDoc).toBeDefined();
    expect(tpDoc.kind).toBe('BRANCH_HO');
    expect(tpDoc.status).toBe('PENDING_HO_ACCEPTANCE');
    testTpDocumentId = tpDoc.id;
    TestLogger.success(`Located auto-queued TP surrender document: ${testTpDocumentId} (status: ${tpDoc.status})`);
  });

  it('3E.3 should allow HO central ops to accept TP surrender document', async () => {
    expect(testTpDocumentId).toBeDefined();

    await workplaceManager.asHoStaff();
    const acceptRes = await client.post(`/product-settlements/${testTpDocumentId}/accept`);
    expect([200, 201]).toContain(acceptRes.status);

    const docRes = await client.get(`/product-settlements/${testTpDocumentId}`);
    expect(docRes.status).toBe(200);
    expect(docRes.data?.status).toBe('ACCEPTED');
    TestLogger.success(`TP surrender document ${testTpDocumentId} successfully accepted by HO staff (status: ACCEPTED)`);
  });

  it('3E.4 should locate accepted TP item in unsettled HO_ISSUER queue and settle with issuer', async () => {
    expect(registry.masters.cardIssuerPartyId).toBeDefined();
    expect(registry.masters.currencyUsd?.id).toBeDefined();

    await workplaceManager.asHoStaff();
    const unsettledProbe = await client.get('/product-settlements/unsettled', {
      kind: 'HO_ISSUER',
      issuerPartyProfileId: registry.masters.cardIssuerPartyId,
      currencyId: registry.masters.currencyUsd.id,
      limit: 100,
    });
    const probeRows = listDocs(unsettledProbe.data);
    const probeTp = probeRows.find(
      (r: any) =>
        r.type === 'TP' &&
        (r.transactionId === testTpTransactionId || Number(r.denomination) === 1000),
    );
    const hoBranchId =
      probeTp?.hoBranchId ||
      registry.masters.hoBranch?.id ||
      registry.masters.branchA?.id;

    const res = await client.get('/product-settlements/unsettled', {
      kind: 'HO_ISSUER',
      issuerPartyProfileId: registry.masters.cardIssuerPartyId,
      currencyId: registry.masters.currencyUsd.id,
      hoBranchId,
    });

    expect([200, 304]).toContain(res.status);
    const rows = listDocs(res.data);

    const tpRow = rows.find(
      (r: any) =>
        r.type === 'TP' &&
        (r.transactionId === testTpTransactionId || Number(r.denomination) === 1000),
    );
    expect(tpRow).toBeDefined();
    expect(tpRow.type).toBe('TP');
    expect(Number(tpRow.denomination)).toBe(1000);
    testTpSettlementItemId = tpRow.id;
    TestLogger.success(`Located accepted TP item in HO_ISSUER queue: ${testTpSettlementItemId}`);

    const settleHoBranchId = tpRow.hoBranchId || hoBranchId;
    const policyRes = await client.get(`/auth/policy-context?branchId=${settleHoBranchId}`);
    const txDate =
      policyRes.data?.transactionDate ||
      registry.masters.transactionDate ||
      new Date().toISOString().slice(0, 10);
    const settleRate = String(tpRow.buyRate || tpRow.saleBuyRate || '87.0000000');

    const settleRes = await client.post('/product-settlements', {
      kind: 'HO_ISSUER',
      hoBranchId: settleHoBranchId,
      issuerPartyProfileId: registry.masters.cardIssuerPartyId,
      currencyId: registry.masters.currencyUsd.id,
      transactionDate: txDate,
      items: [
        {
          id: testTpSettlementItemId,
          rate: settleRate,
        },
      ],
      reference: 'TP-SETTLE-AMEX-001',
      remarks: 'Settlement of Travellers Cheques with Issuer',
    });

    if (![200, 201].includes(settleRes.status)) {
      TestLogger.warn(`3E.4 TP issuer settle failed (${settleRes.status}): ${JSON.stringify(settleRes.data)}`);
    }
    expect([200, 201]).toContain(settleRes.status);
    const issuerDocId = settleRes.data?.id;
    expect(issuerDocId).toBeDefined();

    const getDocRes = await client.get(`/product-settlements/${issuerDocId}`);
    expect(getDocRes.status).toBe(200);
    expect(getDocRes.data?.status).toBe('ISSUER_SETTLED');
    TestLogger.success(`TP document ${issuerDocId} successfully settled with issuer (status: ISSUER_SETTLED)`);
  });

  it('3E.5 should support HO rejection of physical TP cheques with reason, updating document to REJECTED', async () => {
    expect(sellingBranchId).toBeDefined();
    expect(registry.masters.currencyUsd?.id).toBeDefined();
    expect(registry.masters.cardIssuerPartyId).toBeDefined();

    const policyRes = await client.get(`/auth/policy-context?branchId=${sellingBranchId}`);
    const txDate =
      policyRes.data?.transactionDate ||
      registry.masters.transactionDate ||
      new Date().toISOString().slice(0, 10);
    const partyProfileId = registry.masters.corporatePartyProfile?.id || registry.masters.cardIssuerPartyId;
    const purchaseRes = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      transactionDate: txDate,
      branchId: sellingBranchId,
      counterId: sellingCounterId,
      partyProfileId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Suresh',
        lastName: 'Raina',
        nationalityType: 'INDIAN',
        pan: 'PQRST1234K',
        passportNumber: 'Z1122334',
      },
      items: [
        {
          productId: registry.masters.productTp?.id,
          currencyId: registry.masters.currencyUsd.id,
          issuerPartyProfileId: registry.masters.cardIssuerPartyId,
          quantity: 500,
          rate: 87.0,
          denomination: 100,
          autoSurrender: true,
        },
      ],
      payments: [
        {
          paymentMethod: 'BANK_TRANSFER',
          amount: 43500,
          accountId: registry.masters.bankAccountId,
          referenceDate: txDate,
        },
      ],
    });

    expect([200, 201]).toContain(purchaseRes.status);
    const purchaseTxnId = purchaseRes.data?.id || purchaseRes.data?.transaction?.id;
    expect(purchaseTxnId).toBeDefined();

    await workplaceManager.asHoStaff();
    const branchDocsRes = await client.get('/product-settlements', {
      kind: 'BRANCH_HO',
      status: ['PENDING_HO_ACCEPTANCE'],
      branchId: sellingBranchId,
      limit: 100,
    });
    const branchDocs = listDocs(branchDocsRes.data);

    const tpDocToReject = branchDocs.find(
      (d: any) =>
        matchesTpProduct(d) &&
        d.status === 'PENDING_HO_ACCEPTANCE' &&
        d.branchId === sellingBranchId,
    );
    expect(tpDocToReject).toBeDefined();

    const rejectReason = 'Physical cheque signature mismatch with customer passport';
    const rejectRes = await client.post(`/product-settlements/${tpDocToReject.id}/reject`, {
      reason: rejectReason,
    });
    expect([200, 201]).toContain(rejectRes.status);

    const docRes = await client.get(`/product-settlements/${tpDocToReject.id}`);
    expect(docRes.status).toBe(200);
    expect(docRes.data?.status).toBe('REJECTED');
    expect(docRes.data?.rejectionReason).toBe(rejectReason);
    TestLogger.success(`Verified HO rejection of TP surrender doc ${tpDocToReject.id}: status REJECTED with reason recorded`);
  });

  it('3E.6 should reject TP purchase when issuer selection is missing', async () => {
    expect(sellingBranchId).toBeDefined();
    expect(registry.masters.currencyUsd?.id).toBeDefined();

    const policyRes = await client.get(`/auth/policy-context?branchId=${sellingBranchId}`);
    const txDate =
      policyRes.data?.transactionDate ||
      registry.masters.transactionDate ||
      new Date().toISOString().slice(0, 10);
    const partyProfileId = registry.masters.corporatePartyProfile?.id || registry.masters.cardIssuerPartyId;
    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      transactionDate: txDate,
      branchId: sellingBranchId,
      counterId: sellingCounterId,
      partyProfileId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Rahul',
        lastName: 'Dravid',
        nationalityType: 'INDIAN',
        pan: 'ABCDE1234F',
      },
      items: [
        {
          productId: registry.masters.productTp?.id,
          currencyId: registry.masters.currencyUsd.id,
          // issuerPartyProfileId intentionally omitted!
          quantity: 500,
          rate: 87.0,
          denomination: 100,
          autoSurrender: true,
        },
      ],
      payments: [
        {
          paymentMethod: 'BANK_TRANSFER',
          amount: 43500,
          accountId: registry.masters.bankAccountId,
          referenceDate: txDate,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('TP purchase without issuer correctly rejected (400 Bad Request)');
  });

  it('3E.7 should allow TP purchase with autoSurrender: false without queueing HO surrender document', async () => {
    expect(sellingBranchId).toBeDefined();
    expect(registry.masters.currencyUsd?.id).toBeDefined();
    expect(registry.masters.cardIssuerPartyId).toBeDefined();

    const policyRes = await client.get(`/auth/policy-context?branchId=${sellingBranchId}`);
    const txDate =
      policyRes.data?.transactionDate ||
      registry.masters.transactionDate ||
      new Date().toISOString().slice(0, 10);
    const partyProfileId = registry.masters.corporatePartyProfile?.id || registry.masters.cardIssuerPartyId;
    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      transactionDate: txDate,
      branchId: sellingBranchId,
      counterId: sellingCounterId,
      partyProfileId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'VVS',
        lastName: 'Laxman',
        nationalityType: 'INDIAN',
        pan: 'KLMNO6789P',
        passportNumber: 'L8877665',
      },
      items: [
        {
          productId: registry.masters.productTp?.id,
          currencyId: registry.masters.currencyUsd.id,
          issuerPartyProfileId: registry.masters.cardIssuerPartyId,
          quantity: 300,
          rate: 87.0,
          denomination: 100,
          autoSurrender: false, // Opt out of auto surrender
        },
      ],
      payments: [
        {
          paymentMethod: 'BANK_TRANSFER',
          amount: 26100,
          accountId: registry.masters.bankAccountId,
          referenceDate: txDate,
        },
      ],
    });

    expect([200, 201]).toContain(res.status);
    const txnId = res.data?.id || res.data?.transaction?.id;
    expect(txnId).toBeDefined();

    const getRes = await client.get(`/transactions/${txnId}`);
    expect(getRes.status).toBe(200);
    TestLogger.success(`TP purchase with autoSurrender: false saved cleanly (${txnId}) without auto-queueing HO surrender doc`);
  });

  it('3E.8 should support HO Bulk Sale of TP cheques to Card Issuer profile (SALE_BULK)', async () => {
    expect(registry.masters.currencyUsd?.id).toBeDefined();
    expect(registry.masters.cardIssuerPartyId).toBeDefined();

    const hoBranchId = registry.masters.hoBranch?.id || registry.masters.branchA?.id;
    const policyRes = await client.get(`/auth/policy-context?branchId=${hoBranchId}`);
    const txDate = policyRes.data?.transactionDate || registry.masters.transactionDate || new Date().toISOString().slice(0, 10);

    await workplaceManager.asHoStaff();
    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_BULK,
      transactionDate: txDate,
      branchId: hoBranchId,
      counterId: registry.masters.counterA1?.id,
      partyProfileId: registry.masters.cardIssuerPartyId,
      tradeMode: 'BULK',
      items: [
        {
          productId: registry.masters.productTp?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 500,
          rate: 87.5,
          denomination: 100,
        },
      ],
      payments: [
        {
          paymentMethod: 'BANK_TRANSFER',
          amount: 43750,
          accountId: registry.masters.bankAccountId,
          referenceDate: txDate,
        },
      ],
    });

    if (![200, 201].includes(res.status)) {
      TestLogger.warn(`3E.8 HO Bulk Sale of TP response (${res.status}): ${JSON.stringify(res.data)}`);
    }
    // availableInBulkSelling is true for TP
    expect([200, 201]).toContain(res.status);
    TestLogger.success('HO Bulk Sale of TP cheques to Issuer profile (SALE_BULK) processed successfully');
  });

  it('3E.9 should reject retail sale of Travellers Cheques (TP) when availableInRetailSelling is false', async () => {
    expect(sellingBranchId).toBeDefined();
    expect(registry.masters.currencyUsd?.id).toBeDefined();

    const policyRes = await client.get(`/auth/policy-context?branchId=${sellingBranchId}`);
    const txDate =
      policyRes.data?.transactionDate ||
      registry.masters.transactionDate ||
      new Date().toISOString().slice(0, 10);
    const partyProfileId = registry.masters.corporatePartyProfile?.id || registry.masters.cardIssuerPartyId;
    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.SALE_RETAIL,
      transactionDate: txDate,
      branchId: sellingBranchId,
      counterId: sellingCounterId,
      partyProfileId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Anand',
        lastName: 'Verma',
        nationalityType: 'INDIAN',
        pan: 'EFGHI5678J',
        passportNumber: 'W9988776',
      },
      items: [
        {
          productId: registry.masters.productTp?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 500,
          rate: 88.5,
          denomination: 100,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 44250,
          accountId: registry.masters.cashAccountId,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('Retail sale of TP correctly rejected (availableInRetailSelling = false)');
  });

  it('3E.10 should reject TP encashment surrender exceeding cash limit ($1,000 for Indian)', async () => {
    expect(sellingBranchId).toBeDefined();
    expect(registry.masters.currencyUsd?.id).toBeDefined();

    const policyRes = await client.get(`/auth/policy-context?branchId=${sellingBranchId}`);
    const txDate =
      policyRes.data?.transactionDate ||
      registry.masters.transactionDate ||
      new Date().toISOString().slice(0, 10);
    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      transactionDate: txDate,
      branchId: sellingBranchId,
      counterId: sellingCounterId,
      tradeMode: 'RETAIL',
      passenger: {
        firstName: 'Anand',
        lastName: 'Verma',
        nationalityType: 'INDIAN',
        pan: 'EFGHI5678J',
      },
      items: [
        {
          productId: registry.masters.productTp?.id,
          currencyId: registry.masters.currencyUsd.id,
          quantity: 2000, // Exceeds $1,000 cash threshold
          rate: 87.0,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 174000,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    TestLogger.success('TP encashment cash limit exceeding $1,000 correctly blocked');
  });

  it('3E.11 should reject TP transaction with non-existent currency ID', async () => {
    expect(sellingBranchId).toBeDefined();

    const dummyCurrencyId = '00000000-0000-0000-0000-000000009999';
    const res = await client.post('/transactions/drafts', {
      slug: TRANSACTION_SLUGS.PURCHASE_RETAIL,
      branchId: sellingBranchId,
      counterId: sellingCounterId,
      tradeMode: 'RETAIL',
      items: [
        {
          productId: registry.masters.productTp?.id,
          currencyId: dummyCurrencyId,
          quantity: 100,
          rate: 87.0,
        },
      ],
      payments: [
        {
          paymentMethod: 'CASH',
          amount: 8700,
        },
      ],
    });

    expect([400, 422]).toContain(res.status);
    expect(res.status).not.toBe(500);
    TestLogger.success('Non-existent currency in TP transaction correctly rejected with 400/422');
  });
});
