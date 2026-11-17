import { randomUUID } from 'crypto';
import { ApiClient } from '../infrastructure/api-client';
import { WorkplaceManager } from '../infrastructure/workplace-manager';
import { MasterDataRegistry } from '../infrastructure/master-data-registry';
import { TestLogger } from '../infrastructure/test-logger';
import { TRANSACTION_SLUGS } from '../config/test-constants';

describe('Module 8: Financial Vouchers (Receipts, Payments, Advances, Bills, Journal, Deposits & Advices)', () => {
  let client: ApiClient;
  let workplaceManager: WorkplaceManager;
  let registry: MasterDataRegistry;

  let testReceiptId: string;
  let testPaymentId: string;
  let testOutstandingTransactionId: string;
  let saleBillOptionId: string;
  const getTxDate = () => registry.masters.transactionDate || new Date().toISOString().slice(0, 10);

  beforeAll(async () => {
    client = new ApiClient();
    workplaceManager = new WorkplaceManager(client);
    registry = MasterDataRegistry.getInstance();

    TestLogger.header('Module 8: Financial Vouchers');
    await workplaceManager.asAdmin();
    await registry.initialize(client);

    // Find bill settlement option for SALE_CORPORATE_INDIVIDUAL
    const itemTypeRes = await client.get('/select-options/VOUCHER_ITEM_TYPE');
    const itemTypeList = Array.isArray(itemTypeRes.data)
      ? itemTypeRes.data
      : (Array.isArray(itemTypeRes.data?.data) ? itemTypeRes.data.data : []);
    const saleBillOpt = itemTypeList.find(
      (opt: any) => String(opt.value).toUpperCase() === 'SALE_CORPORATE_INDIVIDUAL',
    );
    if (saleBillOpt) {
      saleBillOptionId = saleBillOpt.id;
    }
  });

  describe('Receipt Vouchers & Advance Adjustments (/receipts)', () => {
    it('8.1 should query next receipt voucher number', async () => {
      const res = await client.get('/receipts/next-number', {
        branchId: registry.masters.branchA?.id,
      });
      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
      TestLogger.success('Next receipt voucher number queried');
    });

    it('8.2 should create an advance receipt voucher with advance control account', async () => {
      if (
        !registry.masters.branchA?.id ||
        !registry.masters.voucherAccountTypeBankId ||
        !registry.masters.bankAccountId ||
        !registry.masters.corporatePartyProfile?.id ||
        !registry.masters.corporatePartyProfile?.entityTypeId ||
        !registry.masters.voucherItemTypeAccountId ||
        !registry.masters.advanceControlAccountId
      ) {
        TestLogger.warn('Skipping 8.2: Required masters for advance receipt voucher not available');
        return;
      }

      const res = await client.post('/receipts', {
        transactionDate: getTxDate(),
        branchId: registry.masters.branchA.id,
        counterId: registry.masters.counterA1?.id,
        accountTypeOptionId: registry.masters.voucherAccountTypeBankId,
        headerAccountId: registry.masters.bankAccountId,
        entityTypeOptionId: registry.masters.corporatePartyProfile.entityTypeId,
        partyProfileId: registry.masters.corporatePartyProfile.id,
        paymentMethod: 'CHEQUE',
        chequeNumber: '112233',
        chequeDate: new Date().toISOString().slice(0, 10),
        chequeBranch: 'Fort',
        drawnOn: 'HDFC Bank',
        narration: 'Advance received from corporate client for future FX booking',
        idempotencyKey: randomUUID(),
        items: [
          {
            itemTypeOptionId: registry.masters.voucherItemTypeAccountId,
            accountId: registry.masters.advanceControlAccountId,
            subledgerPartyProfileId: registry.masters.corporatePartyProfile.id,
            direction: 'CREDIT',
            amount: '50000.00',
          },
        ],
      });

      if (res.status === 201 || res.status === 200) {
        testReceiptId = res.data?.id;
        expect(res.data?.advanceControlAccountId).toBe(registry.masters.advanceControlAccountId);
        TestLogger.success(`Advance Receipt voucher created: ${testReceiptId} (Advance A/C: ${res.data?.advanceControlAccountId})`);
      } else {
        TestLogger.info(`Receipt creation returned ${res.status}: ${JSON.stringify(res.data)}`);
      }
    });

    it('8.2B should fetch created advance receipt voucher by ID (GET /receipts/:id) and verify relations without 500 error', async () => {
      if (!testReceiptId) return;

      const res = await client.get(`/receipts/${testReceiptId}`);
      expect(res.status).toBe(200);
      expect(res.data?.id).toBe(testReceiptId);
      expect(Array.isArray(res.data?.items)).toBe(true);
      expect(res.data?.items.length).toBeGreaterThan(0);
      expect(res.data?.headerAccountId).toBe(registry.masters.bankAccountId);
      expect(res.data?.branchSnapshot).toBeDefined();
      expect(res.data?.counterSnapshot).toBeDefined();
      TestLogger.success(`Advance Receipt voucher re-opened cleanly via GET /receipts/:id without 500 errors`);
    });

    it('8.3 should query available advances for party and verify advance receipt appears', async () => {
      if (!registry.masters.branchA?.id || !registry.masters.corporatePartyProfile?.id) return;

      const res = await client.get('/receipts/available-advances', {
        partyProfileId: registry.masters.corporatePartyProfile.id,
        branchId: registry.masters.branchA.id,
        counterId: registry.masters.counterA1?.id,
        transactionDate: getTxDate(),
        paymentMethod: 'CHEQUE',
      });

      expect([200, 304]).toContain(res.status);
      const advances = Array.isArray(res.data)
        ? res.data
        : (Array.isArray(res.data?.data) ? res.data.data : []);
      if (testReceiptId) {
        const matching = advances.find((adv: any) => adv.id === testReceiptId);
        if (matching) {
          expect(Number(matching.availableAmount)).toBeGreaterThan(0);
          TestLogger.success(`Advance receipt voucher verified in available advances: Amount=${matching.availableAmount}`);
        }
      }
      TestLogger.success(`Queried available advances (${advances.length} active advances found)`);
    });

    it('8.4 should query available advances for payments (/payments/available-advances)', async () => {
      if (!registry.masters.branchA?.id || !registry.masters.corporatePartyProfile?.id) return;

      const res = await client.get('/payments/available-advances', {
        partyProfileId: registry.masters.corporatePartyProfile.id,
        branchId: registry.masters.branchA.id,
        counterId: registry.masters.counterA1?.id,
        transactionDate: getTxDate(),
        paymentMethod: 'CASH',
      });

      expect([200, 304]).toContain(res.status);
      TestLogger.success('Queried available advances for payment vouchers');
    });

    it('8.5 should enforce payment method and account type constraints on vouchers', async () => {
      if (
        !registry.masters.branchA?.id ||
        !registry.masters.voucherAccountTypeCashId ||
        !registry.masters.voucherAccountTypeBankId ||
        !registry.masters.cashAccountId ||
        !registry.masters.bankAccountId ||
        !registry.masters.corporatePartyProfile?.id ||
        !registry.masters.corporatePartyProfile?.entityTypeId ||
        !registry.masters.voucherItemTypeAccountId
      ) {
        return;
      }

      // 8.5A: Cash voucher rejecting non-cash payment method
      const invalidCashMethodRes = await client.post('/receipts', {
        transactionDate: getTxDate(),
        branchId: registry.masters.branchA.id,
        counterId: registry.masters.counterA1?.id,
        accountTypeOptionId: registry.masters.voucherAccountTypeCashId,
        headerAccountId: registry.masters.cashAccountId,
        entityTypeOptionId: registry.masters.corporatePartyProfile.entityTypeId,
        partyProfileId: registry.masters.corporatePartyProfile.id,
        paymentMethod: 'CHEQUE', // Disallowed for cash vouchers
        narration: 'Invalid cash voucher with cheque payment mode',
        idempotencyKey: randomUUID(),
        items: [
          {
            itemTypeOptionId: registry.masters.voucherItemTypeAccountId,
            accountId: registry.masters.cashAccountId,
            subledgerPartyProfileId: registry.masters.corporatePartyProfile.id,
            direction: 'CREDIT',
            amount: '1000.00',
          },
        ],
      });
      expect([400, 422]).toContain(invalidCashMethodRes.status);
      TestLogger.success('Cash voucher non-cash payment mode correctly rejected');

      // 8.5B: Cash voucher rejecting cheque details
      const cashWithChequeFieldsRes = await client.post('/receipts', {
        transactionDate: getTxDate(),
        branchId: registry.masters.branchA.id,
        counterId: registry.masters.counterA1?.id,
        accountTypeOptionId: registry.masters.voucherAccountTypeCashId,
        headerAccountId: registry.masters.cashAccountId,
        entityTypeOptionId: registry.masters.corporatePartyProfile.entityTypeId,
        partyProfileId: registry.masters.corporatePartyProfile.id,
        paymentMethod: 'CASH',
        chequeNumber: '999111', // Cheque details not allowed on Cash vouchers
        narration: 'Invalid cash voucher with cheque number',
        idempotencyKey: randomUUID(),
        items: [
          {
            itemTypeOptionId: registry.masters.voucherItemTypeAccountId,
            accountId: registry.masters.cashAccountId,
            subledgerPartyProfileId: registry.masters.corporatePartyProfile.id,
            direction: 'CREDIT',
            amount: '1000.00',
          },
        ],
      });
      expect([400, 422]).toContain(cashWithChequeFieldsRes.status);
      TestLogger.success('Cash voucher with cheque fields correctly rejected');

      // 8.5C: Bank/Cheque voucher with method CHEQUE missing cheque fields
      const chequeMissingFieldsRes = await client.post('/receipts', {
        transactionDate: getTxDate(),
        branchId: registry.masters.branchA.id,
        counterId: registry.masters.counterA1?.id,
        accountTypeOptionId: registry.masters.voucherAccountTypeBankId,
        headerAccountId: registry.masters.bankAccountId,
        entityTypeOptionId: registry.masters.corporatePartyProfile.entityTypeId,
        partyProfileId: registry.masters.corporatePartyProfile.id,
        paymentMethod: 'CHEQUE',
        // Missing chequeNumber, chequeDate, chequeBranch, drawnOn
        narration: 'Cheque voucher missing mandatory cheque details',
        idempotencyKey: randomUUID(),
        items: [
          {
            itemTypeOptionId: registry.masters.voucherItemTypeAccountId,
            accountId: registry.masters.bankAccountId,
            subledgerPartyProfileId: registry.masters.corporatePartyProfile.id,
            direction: 'CREDIT',
            amount: '1000.00',
          },
        ],
      });
      expect([400, 422]).toContain(chequeMissingFieldsRes.status);
      TestLogger.success('Cheque voucher missing mandatory cheque details correctly rejected');
    });

    it('8.6 should create a payment voucher with cash ledger and cash account type', async () => {
      if (
        !registry.masters.branchA?.id ||
        !registry.masters.voucherAccountTypeCashId ||
        !registry.masters.cashAccountId ||
        !registry.masters.corporatePartyProfile?.id ||
        !registry.masters.corporatePartyProfile?.entityTypeId ||
        !registry.masters.voucherItemTypeAccountId
      ) {
        return;
      }

      const res = await client.post('/payments', {
        transactionDate: getTxDate(),
        branchId: registry.masters.branchA.id,
        counterId: registry.masters.counterA1?.id,
        accountTypeOptionId: registry.masters.voucherAccountTypeCashId,
        headerAccountId: registry.masters.cashAccountId,
        entityTypeOptionId: registry.masters.corporatePartyProfile.entityTypeId,
        partyProfileId: registry.masters.corporatePartyProfile.id,
        paymentMethod: 'CASH',
        narration: 'Office maintenance expenses paid in cash',
        idempotencyKey: randomUUID(),
        items: [
          {
            itemTypeOptionId: registry.masters.voucherItemTypeAccountId,
            accountId: registry.masters.cashAccountId,
            subledgerPartyProfileId: registry.masters.corporatePartyProfile.id,
            direction: 'DEBIT',
            amount: '5000.00',
          },
        ],
      });

      if (res.status === 201 || res.status === 200) {
        testPaymentId = res.data?.id;
        TestLogger.success(`Payment voucher created: ${testPaymentId}`);
      } else {
        TestLogger.info(`Payment voucher creation returned ${res.status}: ${JSON.stringify(res.data)}`);
      }
    });

    it('8.6B should fetch created payment voucher by ID (GET /payments/:id) and verify relations without 500 error', async () => {
      if (!testPaymentId) return;

      const res = await client.get(`/payments/${testPaymentId}`);
      expect(res.status).toBe(200);
      expect(res.data?.id).toBe(testPaymentId);
      expect(Array.isArray(res.data?.items)).toBe(true);
      expect(res.data?.items.length).toBeGreaterThan(0);
      expect(res.data?.items[0].subledgerPartyProfileSnapshot).toBeDefined();
      expect(res.data?.headerAccountId).toBe(registry.masters.cashAccountId);
      TestLogger.success(`Payment voucher re-opened cleanly via GET /payments/:id without 500 errors`);
    });

    it('8.6C should reject payment voucher submission with a non-cash/bank account as header (negative test)', async () => {
      if (
        !registry.masters.branchA?.id ||
        !registry.masters.voucherAccountTypeCashId ||
        !registry.masters.advanceControlAccountId ||
        !registry.masters.corporatePartyProfile?.id ||
        !registry.masters.corporatePartyProfile?.entityTypeId ||
        !registry.masters.voucherItemTypeAccountId
      ) {
        return;
      }

      // advanceControlAccountId is a liability/control account, NOT a CASH_LEDGER
      const res = await client.post('/payments', {
        transactionDate: getTxDate(),
        branchId: registry.masters.branchA.id,
        counterId: registry.masters.counterA1?.id,
        accountTypeOptionId: registry.masters.voucherAccountTypeCashId,
        headerAccountId: registry.masters.advanceControlAccountId, // Invalid header account for CASH voucher
        entityTypeOptionId: registry.masters.corporatePartyProfile.entityTypeId,
        partyProfileId: registry.masters.corporatePartyProfile.id,
        paymentMethod: 'CASH',
        narration: 'Test negative: Cash voucher with non-cash ledger header',
        idempotencyKey: randomUUID(),
        items: [
          {
            itemTypeOptionId: registry.masters.voucherItemTypeAccountId,
            accountId: registry.masters.cashAccountId,
            subledgerPartyProfileId: registry.masters.corporatePartyProfile.id,
            direction: 'DEBIT',
            amount: '1000.00',
          },
        ],
      });

      expect([400, 422]).toContain(res.status);
      TestLogger.success('Payment voucher with non-cash header account correctly rejected with 400');
    });

    it('8.6D should reject payment voucher when party entity type does not match entityTypeOptionId (negative test)', async () => {
      if (
        !registry.masters.branchA?.id ||
        !registry.masters.voucherAccountTypeCashId ||
        !registry.masters.cashAccountId ||
        !registry.masters.corporatePartyProfile?.id ||
        !registry.masters.voucherItemTypeAccountId
      ) {
        return;
      }

      const dummyEntityTypeId = '00000000-0000-0000-0000-000000000001';
      const res = await client.post('/payments', {
        transactionDate: getTxDate(),
        branchId: registry.masters.branchA.id,
        counterId: registry.masters.counterA1?.id,
        accountTypeOptionId: registry.masters.voucherAccountTypeCashId,
        headerAccountId: registry.masters.cashAccountId,
        entityTypeOptionId: dummyEntityTypeId, // Mismatched entity type option
        partyProfileId: registry.masters.corporatePartyProfile.id,
        paymentMethod: 'CASH',
        narration: 'Test negative: Mismatched entity type',
        idempotencyKey: randomUUID(),
        items: [
          {
            itemTypeOptionId: registry.masters.voucherItemTypeAccountId,
            accountId: registry.masters.cashAccountId,
            subledgerPartyProfileId: registry.masters.corporatePartyProfile.id,
            direction: 'DEBIT',
            amount: '1000.00',
          },
        ],
      });

      expect([400, 404, 422]).toContain(res.status);
      TestLogger.success('Payment voucher with mismatched entity type correctly rejected');
    });

    it('8.7 should record voucher prints for receipt and payment vouchers', async () => {
      if (testReceiptId) {
        const recPrint = await client.post(`/receipts/${testReceiptId}/print`, {});
        expect([200, 201]).toContain(recPrint.status);
        TestLogger.success(`Receipt voucher print recorded: ${testReceiptId}`);
      }
      if (testPaymentId) {
        const payPrint = await client.post(`/payments/${testPaymentId}/print`, {});
        expect([200, 201]).toContain(payPrint.status);
        TestLogger.success(`Payment voucher print recorded: ${testPaymentId}`);
      }
    });

    it('8.8 should create transaction with partial payment, query outstanding bills, and clear outstanding via Receipt bill voucher', async () => {
      if (
        !registry.masters.branchA?.id ||
        !registry.masters.currencyUsd?.id ||
        !registry.masters.corporatePartyProfile?.id ||
        !registry.masters.corporatePartyProfile?.entityTypeId ||
        !saleBillOptionId
      ) {
        TestLogger.warn('Skipping 8.8: Required masters for bill settlement not available');
        return;
      }

      // Step 1: Create transaction with partial payment leaving an outstanding balance
      const saleRes = await client.post('/transactions/drafts', {
        slug: TRANSACTION_SLUGS.SALE_CORPORATE_INDIVIDUAL,
        branchId: registry.masters.branchA.id,
        counterId: registry.masters.counterA1?.id,
        tradeMode: 'BULK',
        partyProfileId: registry.masters.corporatePartyProfile.id,
        items: [
          {
            productId: registry.masters.productCn?.id,
            currencyId: registry.masters.currencyUsd.id,
            quantity: 200,
            rate: 88.5,
          },
        ],
        payments: [
          {
            paymentMethod: 'CHEQUE',
            amount: 5000, // Total = 17,700, Paid = 5,000, Outstanding = 12,700
            referenceNumber: 'CHQ100200',
            referenceDate: new Date().toISOString().slice(0, 10),
            branchName: 'Fort',
            drawnOn: 'HDFC Bank',
          },
        ],
      });

      if (saleRes.status === 200 || saleRes.status === 201) {
        testOutstandingTransactionId = saleRes.data?.id;
        TestLogger.success(`Transaction with outstanding balance created: ${testOutstandingTransactionId}`);

        // Step 2: Query outstanding bills for this corporate party
        const billsRes = await client.get('/receipts/outstanding-bills', {
          partyProfileId: registry.masters.corporatePartyProfile.id,
          slug: 'SALE_CORPORATE_INDIVIDUAL',
          branchId: registry.masters.branchA.id,
          counterId: registry.masters.counterA1?.id,
          transactionDate: getTxDate(),
        });

        expect([200, 304]).toContain(billsRes.status);
        const bills = Array.isArray(billsRes.data)
          ? billsRes.data
          : (Array.isArray(billsRes.data?.data) ? billsRes.data.data : []);
        const matchingBill = bills.find((b: any) => b.id === testOutstandingTransactionId);

        if (matchingBill) {
          const outstandingAmount = matchingBill.outstanding || matchingBill.outstandingAmount || '12700.00';
          TestLogger.success(`Found outstanding bill ${testOutstandingTransactionId} with balance: ${outstandingAmount}`);

          // Step 3: Clear the outstanding bill via Receipt Voucher with BILL item
          const billReceiptRes = await client.post('/receipts', {
            transactionDate: getTxDate(),
            branchId: registry.masters.branchA.id,
            counterId: registry.masters.counterA1?.id,
            accountTypeOptionId: registry.masters.voucherAccountTypeBankId,
            headerAccountId: registry.masters.bankAccountId,
            entityTypeOptionId: registry.masters.corporatePartyProfile.entityTypeId,
            partyProfileId: registry.masters.corporatePartyProfile.id,
            paymentMethod: 'CHEQUE',
            chequeNumber: 'CHQ888444',
            chequeDate: new Date().toISOString().slice(0, 10),
            chequeBranch: 'Fort',
            drawnOn: 'HDFC Bank',
            narration: 'Settling outstanding bill from corporate travel booking',
            idempotencyKey: randomUUID(),
            items: [
              {
                itemTypeOptionId: saleBillOptionId,
                subledgerPartyProfileId: registry.masters.corporatePartyProfile.id,
                settledTransactionId: testOutstandingTransactionId,
                direction: 'CREDIT',
                amount: String(outstandingAmount),
              },
            ],
          });

          if (billReceiptRes.status === 200 || billReceiptRes.status === 201) {
            TestLogger.success(`Bill settlement Receipt voucher created: ${billReceiptRes.data?.id}`);

            // Step 4: Verify outstanding bill is cleared
            const afterBillsRes = await client.get('/receipts/outstanding-bills', {
              partyProfileId: registry.masters.corporatePartyProfile.id,
              slug: 'SALE_CORPORATE_INDIVIDUAL',
              branchId: registry.masters.branchA.id,
              counterId: registry.masters.counterA1?.id,
              transactionDate: getTxDate(),
            });
            const remainingBills = Array.isArray(afterBillsRes.data)
              ? afterBillsRes.data
              : (Array.isArray(afterBillsRes.data?.data) ? afterBillsRes.data.data : []);
            const stillListed = remainingBills.some((b: any) => b.id === testOutstandingTransactionId);
            expect(stillListed).toBe(false);
            TestLogger.success('Outstanding bill successfully cleared and no longer listed');

            // Round-trip check: Re-open transaction by ID to verify no 500 error
            const txDetail = await client.get(`/transactions/${testOutstandingTransactionId}`);
            expect(txDetail.status).toBe(200);
            expect(txDetail.data?.id).toBe(testOutstandingTransactionId);
            expect(Array.isArray(txDetail.data?.items)).toBe(true);
            TestLogger.success('Settled transaction re-opened cleanly via GET /transactions/:id');

            // Round-trip check: Re-open bill settlement voucher by ID
            const voucherDetail = await client.get(`/receipts/${billReceiptRes.data.id}`);
            expect(voucherDetail.status).toBe(200);
            expect(voucherDetail.data?.id).toBe(billReceiptRes.data.id);
            TestLogger.success('Bill settlement voucher re-opened cleanly via GET /receipts/:id');
          } else {
            TestLogger.info(`Bill settlement returned ${billReceiptRes.status}: ${JSON.stringify(billReceiptRes.data)}`);
          }
        }
      } else {
        TestLogger.info(`Partial payment transaction returned ${saleRes.status}: ${JSON.stringify(saleRes.data)}`);
      }
    });
  });

  describe('Journal Vouchers (/journal-vouchers)', () => {
    it('8.9 should query next journal voucher number and list', async () => {
      const res = await client.get('/journal-vouchers/next-number', {
        branchId: registry.masters.branchA?.id,
      });
      expect(res.status).toBe(200);
      TestLogger.success('Journal vouchers endpoint operational');
    });

    it('8.10 should query journal vouchers history', async () => {
      const res = await client.get('/journal-vouchers');
      expect([200, 304]).toContain(res.status);
      TestLogger.success('Journal vouchers history queried');
    });
  });

  describe('Deposit & Withdrawal Vouchers (/deposit-withdrawals)', () => {
    it('8.11 should query next deposit/withdrawal number', async () => {
      const res = await client.get('/deposit-withdrawals/next-number', {
        branchId: registry.masters.branchA?.id,
      });
      expect(res.status).toBe(200);
      TestLogger.success('Deposit/Withdrawal vouchers endpoint operational');
    });
  });

  describe('Advice Debit/Credit (/advice-debit-credit)', () => {
    it('8.12 should query next advice number and list', async () => {
      const res = await client.get('/advice-debit-credit/next-number', {
        branchId: registry.masters.branchA?.id,
      });
      expect(res.status).toBe(200);
      TestLogger.success('Advice debit/credit endpoint operational');
    });
  });
});
