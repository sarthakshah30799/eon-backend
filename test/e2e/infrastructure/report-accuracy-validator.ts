import { FrontendReportEmulator, RenderedReportView, RenderedTableCell } from './frontend-report-emulator';
import { REPORT_SCHEMAS, ReportColumnSpec } from './report-schemas';
import { TestLogger } from './test-logger';

export interface ExpectedTransactionReportMatch {
  transactionNumber: string;
  transactionDate?: string;
  partyProfileName?: string;
  partyProfileCode?: string;
  currencyCode?: string;
  quantity?: number;
  rate?: number;
  grossAmount?: number;
  taxAmount?: number;
  netAmount?: number;
  paymentMethod?: string;
  branchName?: string;
}

export class ReportAccuracyValidator {
  /**
   * Tier 1 & Tier 3: Verify a specific transaction renders accurately on the frontend table
   */
  public static verifyTransactionOnFrontend(
    reportName: string,
    rawApiResponse: any,
    expectedTx: ExpectedTransactionReportMatch
  ): void {
    const renderedView = FrontendReportEmulator.render(reportName, rawApiResponse);

    // Locate the row by transaction number / vno
    const row = renderedView.itemRows.find(r => {
      const vno = r.cells['vno']?.renderedText || r.cells['number']?.renderedText || r.cells['voucherNo']?.renderedText;
      return vno === expectedTx.transactionNumber;
    });

    if (!row) {
      this.throwDiscrepancyError(
        reportName,
        'vno/number',
        expectedTx.transactionNumber,
        'ROW_NOT_FOUND_ON_FRONTEND',
        {
          totalRenderedRows: renderedView.rows.length,
          availableVnos: renderedView.itemRows
            .map(r => r.cells['vno']?.renderedText || r.cells['number']?.renderedText || r.cells['voucherNo']?.renderedText)
            .filter(Boolean)
            .slice(0, 10),
        }
      );
      return;
    }

    // 1. Verify numeric cells with strict precision
    if (expectedTx.quantity !== undefined && row.cells['quantity']) {
      this.assertCellNumber(reportName, row.cells['quantity'], expectedTx.quantity, 0.001);
    }
    if (expectedTx.rate !== undefined && row.cells['rate']) {
      this.assertCellNumber(reportName, row.cells['rate'], expectedTx.rate, 0.01);
    }
    if (expectedTx.grossAmount !== undefined && row.cells['amount']) {
      this.assertCellNumber(reportName, row.cells['amount'], expectedTx.grossAmount, 0.05);
    }
    if (expectedTx.taxAmount !== undefined && row.cells['taxAmount']) {
      this.assertCellNumber(reportName, row.cells['taxAmount'], expectedTx.taxAmount, 0.05);
    }
    if (expectedTx.netAmount !== undefined) {
      const netCell = row.cells['netAmount'] || row.cells['amount'] || row.cells['inrAmount'];
      if (netCell) {
        this.assertCellNumber(reportName, netCell, expectedTx.netAmount, 0.05);
      }
    }

    // 2. Verify string cells
    if (expectedTx.currencyCode && row.cells['currencyCode']) {
      this.assertCellString(reportName, row.cells['currencyCode'], expectedTx.currencyCode);
    }
    if (expectedTx.partyProfileName) {
      const partyCell = row.cells['partyProfileName'] || row.cells['party'] || row.cells['partyName'];
      if (partyCell) {
        this.assertCellString(reportName, partyCell, expectedTx.partyProfileName);
      }
    }
    if (expectedTx.branchName && row.cells['branch']) {
      this.assertCellString(reportName, row.cells['branch'], expectedTx.branchName);
    }

    // 3. Verify no required fields rendered as fallback dash '-'
    for (const [key, cell] of Object.entries(row.cells)) {
      if (['vno', 'date', 'partyProfileName', 'currencyCode', 'netAmount'].includes(key)) {
        if (cell.isFallbackDash) {
          this.throwDiscrepancyError(reportName, key, 'VALID_VALUE', '-', {
            message: `Required column '${cell.columnLabel}' rendered as fallback dash '-' on frontend!`,
            row: row.rawRow,
          });
        }
      }

      // Check no NaN or undefined rendered
      if (cell.renderedText.includes('NaN') || cell.renderedText.includes('undefined') || cell.renderedText.includes('[object')) {
        this.throwDiscrepancyError(reportName, key, 'VALID_FORMATTED_STRING', cell.renderedText, {
          message: `Corrupted string detected in cell for column '${cell.columnLabel}'.`,
        });
      }
    }

    TestLogger.success(`Report '${reportName}' verified on frontend for [${expectedTx.transactionNumber}]`, {
      vno: expectedTx.transactionNumber,
      currency: expectedTx.currencyCode,
      qty: expectedTx.quantity,
      rate: expectedTx.rate,
      net: expectedTx.netAmount,
    });
  }

  /**
   * Tier 2: Verify Mathematical Invariants across the frontend rendered view
   */
  public static verifyMathematicalInvariants(reportName: string, rawApiResponse: any): void {
    const renderedView = FrontendReportEmulator.render(reportName, rawApiResponse);

    if (reportName === 'sale-purchase') {
      let runningSum = 0;
      for (const row of renderedView.rows) {
        if (row.rowType === 'ITEM') {
          const net = parseFloat(row.cells['netAmount']?.renderedText || '0') || 0;
          runningSum += net;
        } else if (row.rowType === 'SUBTOTAL') {
          const subtotalNet = parseFloat(row.cells['netAmount']?.renderedText || '0') || 0;
          if (Math.abs(runningSum - subtotalNet) > 0.1) {
            this.throwDiscrepancyError(reportName, 'SUBTOTAL(netAmount)', runningSum, subtotalNet, {
              message: 'Frontend visible subtotal does not match sum of items in that group!',
              delta: runningSum - subtotalNet,
            });
          }
          runningSum = 0; // Reset for next group
        }
      }
    } else if (reportName === 'currency-balance') {
      for (const row of renderedView.itemRows) {
        const opening = parseFloat(row.cells['opening']?.renderedText || '0') || 0;
        const purchaseBulk = parseFloat(row.cells['purchaseBulk']?.renderedText || '0') || 0;
        const purchaseRetail = parseFloat(row.cells['purchaseRetail']?.renderedText || '0') || 0;
        const sellBulk = parseFloat(row.cells['sellBulk']?.renderedText || '0') || 0;
        const sellRetail = parseFloat(row.cells['sellRetail']?.renderedText || '0') || 0;
        const closing = parseFloat(row.cells['closing']?.renderedText || '0') || 0;

        const expectedClosing = opening + purchaseBulk + purchaseRetail - sellBulk - sellRetail;
        if (Math.abs(expectedClosing - closing) > 0.05) {
          this.throwDiscrepancyError(reportName, 'closing', expectedClosing, closing, {
            message: 'Currency balance formula invariant failed: closing != opening + purchases - sells',
            branch: row.cells['branch']?.renderedText,
            counter: row.cells['counter']?.renderedText,
            formula: `${opening} + ${purchaseBulk} + ${purchaseRetail} - ${sellBulk} - ${sellRetail} = ${expectedClosing}`,
          });
        }
      }
    } else if (reportName === 'cash-report') {
      for (const row of renderedView.itemRows) {
        const receipts = parseFloat(row.cells['receipts']?.renderedText || '0') || 0;
        const payments = parseFloat(row.cells['payments']?.renderedText || '0') || 0;
        const runningBal = parseFloat(row.cells['runningBalance']?.renderedText || '0');
        if (isNaN(runningBal)) {
          this.throwDiscrepancyError(reportName, 'runningBalance', 'VALID_NUMBER', row.cells['runningBalance']?.renderedText, {
            row: row.rawRow,
          });
        }
      }
    } else if (reportName === 'trial-balance') {
      let totalDr = 0;
      let totalCr = 0;
      for (const row of renderedView.itemRows) {
        totalDr += parseFloat(row.cells['transactionDebit']?.renderedText || '0') || 0;
        totalCr += parseFloat(row.cells['transactionCredit']?.renderedText || '0') || 0;
      }
      if (Math.abs(totalDr - totalCr) > 1.0) {
        this.throwDiscrepancyError(reportName, 'trial-balance-invariant', totalDr, totalCr, {
          message: 'Total transaction debits do not equal total transaction credits!',
          difference: totalDr - totalCr,
        });
      }
    }

    TestLogger.success(`Mathematical invariants verified for report '${reportName}' across ${renderedView.rows.length} rows`);
  }

  /**
   * Tier 3: Verify Frontend Column Contract
   */
  public static verifyFrontendContract(reportName: string, rawApiResponse: any): void {
    const renderedView = FrontendReportEmulator.render(reportName, rawApiResponse);
    const schema = REPORT_SCHEMAS[reportName];

    if (!schema) {
      TestLogger.warn(`No predefined column schema for '${reportName}'; skipping strict contract validation.`);
      return;
    }

    // Verify all required schema columns are present in rendered view
    const renderedColKeys = new Set(renderedView.columns.map(c => c.key));
    for (const spec of schema) {
      if (spec.requiredForItems && !renderedColKeys.has(spec.key)) {
        this.throwDiscrepancyError(reportName, spec.key, 'COLUMN_PRESENT', 'COLUMN_MISSING', {
          expectedLabel: spec.label,
          renderedColumns: renderedView.columns.map(c => c.key),
        });
      }
    }

    // Verify all rendered columns have non-empty labels
    for (const col of renderedView.columns) {
      if (!col.label || col.label.trim() === '') {
        this.throwDiscrepancyError(reportName, col.key, 'NON_EMPTY_LABEL', col.label, {
          message: `Column '${col.key}' has empty label in frontend header!`,
        });
      }
    }

    TestLogger.success(`Frontend column contract verified for '${reportName}' (${renderedView.columns.length} columns)`);
  }

  private static assertCellNumber(reportName: string, cell: RenderedTableCell, expected: number, tolerance: number): void {
    const actual = parseFloat(cell?.renderedText || '0');
    if (isNaN(actual) || Math.abs(actual - expected) > tolerance) {
      this.throwDiscrepancyError(reportName, cell?.columnKey || 'unknown', expected, actual, {
        columnLabel: cell?.columnLabel,
        renderedText: cell?.renderedText,
        tolerance,
        diff: isNaN(actual) ? 'NaN' : Math.abs(actual - expected),
      });
    }
  }

  private static assertCellString(reportName: string, cell: RenderedTableCell, expected: string): void {
    const actual = (cell?.renderedText || '').toLowerCase();
    const exp = expected.toLowerCase();
    if (!actual.includes(exp)) {
      this.throwDiscrepancyError(reportName, cell?.columnKey || 'unknown', expected, cell?.renderedText, {
        columnLabel: cell?.columnLabel,
      });
    }
  }

  private static throwDiscrepancyError(
    report: string,
    column: string,
    expected: any,
    actual: any,
    extra: Record<string, any>
  ): void {
    const log = [
      '',
      '==========================================================================================',
      `🚨 FRONTEND REPORT ACCURACY DISCREPANCY DETECTED`,
      '==========================================================================================',
      `  Report:        ${report}`,
      `  Column Key:    ${column}`,
      `  Expected (DB): ${expected}`,
      `  Actual (UI):   ${actual}`,
      `  Details:       ${JSON.stringify(extra, null, 2).split('\n').join('\n                 ')}`,
      '==========================================================================================',
      '',
    ].join('\n');

    TestLogger.failure(`Report Discrepancy in [${report}] on [${column}]`, extra);
    console.error(log);
    throw new Error(`[ReportAccuracyDiscrepancy] ${report} -> ${column}: Expected ${expected} but got ${actual}`);
  }
}

