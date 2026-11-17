import { TestLogger } from './test-logger';

export interface PrintValidationResult {
  isValid: boolean;
  missingElements: string[];
  copyType?: string;
  docNo?: string;
  dateStr?: string;
  foundFields: Record<string, boolean>;
}

export class PrintHtmlValidator {
  /**
   * Validates mandatory elements in rendered Print HTML
   */
  static validateTransactionPrint(html: string): PrintValidationResult {
    const missing: string[] = [];
    const found: Record<string, boolean> = {};

    const checks: Array<{ key: string; label: string; pattern: RegExp }> = [
      { key: 'companyName', label: 'Company Name', pattern: /company|limited|pvt|ltd|forex/i },
      { key: 'branch', label: 'Branch Name & Location', pattern: /branch|mumbai|delhi|bangalore/i },
      { key: 'docNo', label: 'Document Number', pattern: /(doc|bill|invoice|trn|receipt)\s*(no|#|:)/i },
      { key: 'date', label: 'Transaction Date (dd/mm/yyyy)', pattern: /\b(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}\b/ },
      { key: 'partyOrPassenger', label: 'Party / Passenger Name', pattern: /name|passenger|customer|client|m\/s/i },
      { key: 'currencyOrAmount', label: 'Currency & Amount Table', pattern: /(usd|eur|gbp|inr|rate|fc\s*amount|inr\s*amount)/i },
      { key: 'taxOrTcs', label: 'Tax / GST / TCS Breakdown', pattern: /(gst|cgst|sgst|igst|tcs|tax)/i },
      { key: 'paymentMode', label: 'Payment Mode', pattern: /(cash|cheque|bank|transfer|neft|rtgs|upi)/i },
      { key: 'amountInWords', label: 'Amount in Words', pattern: /(rupees|only|\bwords\b)/i },
      { key: 'signature', label: 'Signatures / T&C', pattern: /(signature|authorized|signatory|terms)/i },
    ];

    for (const check of checks) {
      const match = check.pattern.test(html);
      found[check.key] = match;
      if (!match) {
        missing.push(check.label);
      }
    }

    // Check for Copy Type (Original vs Duplicate)
    let copyType = 'UNKNOWN';
    if (/duplicate/i.test(html)) {
      copyType = 'DUPLICATE_COPY';
    } else if (/original|customer\s*copy/i.test(html)) {
      copyType = 'ORIGINAL';
    }

    const isValid = missing.length === 0;
    if (!isValid) {
      TestLogger.warn(`Print HTML missing elements: ${missing.join(', ')}`);
    } else {
      TestLogger.info(`Print HTML schema validation passed [Copy: ${copyType}]`);
    }

    return {
      isValid,
      missingElements: missing,
      copyType,
      foundFields: found,
    };
  }

  /**
   * Validates Voucher Print HTML (Receipt, Payment, Journal, Advice)
   */
  static validateVoucherPrint(html: string): PrintValidationResult {
    const missing: string[] = [];
    const found: Record<string, boolean> = {};

    const checks: Array<{ key: string; label: string; pattern: RegExp }> = [
      { key: 'voucherNo', label: 'Voucher Number', pattern: /(voucher|no|vch)\s*(#|:|\d)/i },
      { key: 'date', label: 'Voucher Date', pattern: /\b(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}\b/ },
      { key: 'account', label: 'Account / Particulars', pattern: /account|particulars|debit|credit/i },
      { key: 'amount', label: 'Voucher Amount', pattern: /amount|total|rs|\b₹\b/i },
      { key: 'narration', label: 'Narration / Remarks', pattern: /narration|remarks|description|being/i },
      { key: 'signature', label: 'Signatures', pattern: /prepared|checked|authorized|signatory/i },
    ];

    for (const check of checks) {
      const match = check.pattern.test(html);
      found[check.key] = match;
      if (!match) {
        missing.push(check.label);
      }
    }

    return {
      isValid: missing.length === 0,
      missingElements: missing,
      foundFields: found,
    };
  }
}

