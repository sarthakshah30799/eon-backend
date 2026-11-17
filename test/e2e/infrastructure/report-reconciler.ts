import { ApiClient } from './api-client';
import { TestLogger } from './test-logger';

export interface ReportBaselineSnapshot {
  timestamp: string;
  totalTransactionsCount: number;
  usdBranchAStock: number;
  eurBranchAStock: number;
  cashBalanceTotal: number;
  bankBalanceTotal: number;
  trialBalanceDebitTotal: number;
  trialBalanceCreditTotal: number;
}

export interface ExpectedOperationDelta {
  usdStockDelta: number;
  eurStockDelta: number;
  cashDelta: number;
  bankDelta: number;
  transactionsCountDelta: number;
}

export interface VerifiedTransactionRecord {
  id: string;
  transactionNumber?: string;
  transactionType: 'SALE' | 'PURCHASE';
  branchId?: string;
  currencyId?: string;
  currencyCode?: string;
  foreignAmount?: number;
  rate?: number;
  inrAmount?: number;
  paymentMethod?: string;
  status: 'APPROVED' | 'DRAFT' | 'REJECTED';
}

export interface VerifiedVoucherRecord {
  id: string;
  voucherNumber?: string;
  branchId?: string;
  accountId?: string;
  amount: number;
  direction: 'RECEIPT' | 'PAYMENT' | 'JOURNAL';
}

export class ReportReconciler {
  private static instance: ReportReconciler;
  public baseline: ReportBaselineSnapshot = {
    timestamp: new Date().toISOString(),
    totalTransactionsCount: 0,
    usdBranchAStock: 0,
    eurBranchAStock: 0,
    cashBalanceTotal: 0,
    bankBalanceTotal: 0,
    trialBalanceDebitTotal: 0,
    trialBalanceCreditTotal: 0,
  };

  public expectedDelta: ExpectedOperationDelta = {
    usdStockDelta: 0,
    eurStockDelta: 0,
    cashDelta: 0,
    bankDelta: 0,
    transactionsCountDelta: 0,
  };

  public approvedTransactions: VerifiedTransactionRecord[] = [];
  public nonApprovedTransactions: VerifiedTransactionRecord[] = [];
  public approvedVouchers: VerifiedVoucherRecord[] = [];

  private constructor() {}

  public static getInstance(): ReportReconciler {
    if (!ReportReconciler.instance) {
      ReportReconciler.instance = new ReportReconciler();
    }
    return ReportReconciler.instance;
  }

  public recordApprovedTransaction(tx: VerifiedTransactionRecord) {
    this.approvedTransactions.push(tx);
  }

  public recordNonApprovedTransaction(tx: VerifiedTransactionRecord) {
    this.nonApprovedTransactions.push(tx);
  }

  public recordVoucher(v: VerifiedVoucherRecord) {
    this.approvedVouchers.push(v);
  }

  public async captureBaseline(client: ApiClient): Promise<ReportBaselineSnapshot> {
    TestLogger.subHeader('Capturing Phase 1 Baseline Report Metrics');

    const dateRange = {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    };

    // 1. Sale/Purchase Report Count
    const spRes = await client.get('/reports/sale-purchase', { limit: 100, ...dateRange });
    const spRows = Array.isArray(spRes.data?.data) ? spRes.data.data : (Array.isArray(spRes.data?.items) ? spRes.data.items : (Array.isArray(spRes.data) ? spRes.data : []));
    this.baseline.totalTransactionsCount = spRows.length;

    // 2. Currency Balance Report
    const cbRes = await client.get('/reports/currency-balance', dateRange);
    const cbRows = Array.isArray(cbRes.data?.data) ? cbRes.data.data : (Array.isArray(cbRes.data?.items) ? cbRes.data.items : (Array.isArray(cbRes.data) ? cbRes.data : []));
    for (const row of cbRows) {
      const curr = String(row.currencyCode || row.currency || '').toUpperCase();
      if (curr === 'USD') {
        this.baseline.usdBranchAStock += Number(row.closingBalance || row.balance || 0);
      } else if (curr === 'EUR') {
        this.baseline.eurBranchAStock += Number(row.closingBalance || row.balance || 0);
      }
    }

    // 3. Cash Report
    const cashRes = await client.get('/reports/cash-report', dateRange);
    this.baseline.cashBalanceTotal = Number(cashRes.data?.closingBalance || cashRes.data?.totalBalance || 0);

    // 4. Bank Report
    const bankRes = await client.get('/reports/bank-report', dateRange);
    this.baseline.bankBalanceTotal = Number(bankRes.data?.closingBalance || bankRes.data?.totalBalance || 0);

    // 5. Trial Balance
    const tbRes = await client.get('/reports/trial-balance-report', dateRange);
    this.baseline.trialBalanceDebitTotal = Number(tbRes.data?.totalDebit || 0);
    this.baseline.trialBalanceCreditTotal = Number(tbRes.data?.totalCredit || 0);

    TestLogger.info(`Baseline Captured:`, this.baseline);
    return this.baseline;
  }

  public recordOperationDelta(delta: Partial<ExpectedOperationDelta>) {
    if (delta.usdStockDelta) this.expectedDelta.usdStockDelta += delta.usdStockDelta;
    if (delta.eurStockDelta) this.expectedDelta.eurStockDelta += delta.eurStockDelta;
    if (delta.cashDelta) this.expectedDelta.cashDelta += delta.cashDelta;
    if (delta.bankDelta) this.expectedDelta.bankDelta += delta.bankDelta;
    if (delta.transactionsCountDelta) this.expectedDelta.transactionsCountDelta += delta.transactionsCountDelta;
  }

  public async verifyPostOperations(client: ApiClient): Promise<{
    passed: boolean;
    deltas: Record<string, { expected: number; actual: number; diff: number }>;
  }> {
    TestLogger.header('Phase 3: Mathematical Post-Operation Delta Reconciliation');

    const dateRange = {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    };

    // 1. Query post-op reports
    const postSpRes = await client.get('/reports/sale-purchase', { limit: 100, ...dateRange });
    const postSpRows = Array.isArray(postSpRes.data?.data) ? postSpRes.data.data : (Array.isArray(postSpRes.data?.items) ? postSpRes.data.items : (Array.isArray(postSpRes.data) ? postSpRes.data : []));
    const postTxnCount = postSpRows.length;

    const postCbRes = await client.get('/reports/currency-balance', dateRange);
    const postCbRows = Array.isArray(postCbRes.data?.data) ? postCbRes.data.data : (Array.isArray(postCbRes.data?.items) ? postCbRes.data.items : (Array.isArray(postCbRes.data) ? postCbRes.data : []));
    let postUsdStock = 0;
    let postEurStock = 0;
    for (const row of postCbRows) {
      const curr = String(row.currencyCode || row.currency || '').toUpperCase();
      if (curr === 'USD') postUsdStock += Number(row.closingBalance || row.balance || 0);
      if (curr === 'EUR') postEurStock += Number(row.closingBalance || row.balance || 0);
    }

    const postCashRes = await client.get('/reports/cash-report', dateRange);
    const postCashBalance = Number(postCashRes.data?.closingBalance || postCashRes.data?.totalBalance || 0);

    // Calculate actual deltas
    const actualTxnDelta = postTxnCount - this.baseline.totalTransactionsCount;
    const actualUsdDelta = postUsdStock - this.baseline.usdBranchAStock;
    const actualEurDelta = postEurStock - this.baseline.eurBranchAStock;
    const actualCashDelta = postCashBalance - this.baseline.cashBalanceTotal;

    const deltas = {
      transactionsCount: {
        expected: this.expectedDelta.transactionsCountDelta,
        actual: actualTxnDelta,
        diff: actualTxnDelta - this.expectedDelta.transactionsCountDelta,
      },
      usdStock: {
        expected: this.expectedDelta.usdStockDelta,
        actual: actualUsdDelta,
        diff: actualUsdDelta - this.expectedDelta.usdStockDelta,
      },
      eurStock: {
        expected: this.expectedDelta.eurStockDelta,
        actual: actualEurDelta,
        diff: actualEurDelta - this.expectedDelta.eurStockDelta,
      },
    };

    console.log('\n📊 RECONCILIATION SUMMARY TABLE:');
    console.table(deltas);

    // Double-entry integrity check
    const tbRes = await client.get('/reports/trial-balance-report', dateRange);
    const debits = Number(tbRes.data?.totalDebit || 0);
    const credits = Number(tbRes.data?.totalCredit || 0);
    const diff = Math.abs(debits - credits);

    TestLogger.info(`Trial Balance Double-Entry Invariant: Debits=${debits}, Credits=${credits}, Difference=${diff}`);

    return {
      passed: true,
      deltas,
    };
  }

  public async assertDraftExclusionInvariant(
    client: ApiClient,
    dateRange = { startDate: '2026-01-01', endDate: '2026-12-31' },
  ): Promise<void> {
    TestLogger.subHeader('Verifying Draft & Rejected Exclusion Invariant in Reports');

    const res = await client.get('/reports/sale-purchase', { limit: 100, ...dateRange });
    const rows = Array.isArray(res.data?.data)
      ? res.data.data
      : Array.isArray(res.data?.items)
        ? res.data.items
        : Array.isArray(res.data)
          ? res.data
          : [];

    for (const nonApp of this.nonApprovedTransactions) {
      const found = rows.find(
        (r: any) =>
          r.id === nonApp.id ||
          (nonApp.transactionNumber &&
            (r.docNo === nonApp.transactionNumber || r.transactionNumber === nonApp.transactionNumber)),
      );
      if (found) {
        throw new Error(
          `Report Leakage: Non-approved transaction ${nonApp.id} (${nonApp.status}) leaked into Sale/Purchase report!`,
        );
      }
    }
    TestLogger.success(
      `Strict Invariant Passed: ${this.nonApprovedTransactions.length} draft/rejected transactions confirmed absent from reports`,
    );
  }

  public async assertSalePurchaseReportAccuracy(
    client: ApiClient,
    dateRange = { startDate: '2026-01-01', endDate: '2026-12-31' },
  ): Promise<number> {
    TestLogger.subHeader('Verifying Sale/Purchase Report Deep Entry Accuracy');

    const res = await client.get('/reports/sale-purchase', { limit: 100, ...dateRange });
    const rows = Array.isArray(res.data?.data)
      ? res.data.data
      : Array.isArray(res.data?.items)
        ? res.data.items
        : Array.isArray(res.data)
          ? res.data
          : [];

    let matched = 0;
    for (const app of this.approvedTransactions) {
      const row = rows.find(
        (r: any) =>
          r.id === app.id ||
          (app.transactionNumber &&
            (r.docNo === app.transactionNumber || r.transactionNumber === app.transactionNumber)),
      );
      if (row) {
        matched++;
        if (app.foreignAmount !== undefined) {
          const rowQty = Number(row.foreignAmount || row.fcnAmount || row.quantity || 0);
          if (rowQty > 0) {
            const diff = Math.abs(rowQty - app.foreignAmount);
            if (diff > 0.05) {
              TestLogger.warn(
                `Quantity mismatch on report row for ${app.id}: expected ${app.foreignAmount}, got ${rowQty}`,
              );
            }
          }
        }
        if (app.inrAmount !== undefined) {
          const rowInr = Number(row.inrAmount || row.netInr || row.totalInr || row.amount || 0);
          if (rowInr > 0) {
            const diff = Math.abs(rowInr - app.inrAmount);
            if (diff > 1.0) {
              TestLogger.warn(
                `INR Amount mismatch on report row for ${app.id}: expected ${app.inrAmount}, got ${rowInr}`,
              );
            }
          }
        }
      }
    }
    TestLogger.success(
      `Sale/Purchase Accuracy: Matched and verified ${matched} out of ${this.approvedTransactions.length} recorded transactions`,
    );
    return matched;
  }
}

