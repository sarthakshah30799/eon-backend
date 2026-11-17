export const REGULATORY_LIMITS = {
  INDIAN_CASH_PURCHASE_USD: 1000,
  NRI_CASH_PURCHASE_USD: 3000,
  CDF_THRESHOLD_USD: 5000,
  CUMULATIVE_WINDOW_DAYS: 30,
  TCS_PAN_THRESHOLD_INR: 700000,
  TCS_EDUCATION_LOAN_RATE: 0.005,
  TCS_TOUR_BASE_RATE: 0.05,
  TCS_TOUR_EXCESS_RATE: 0.20,
  TCS_NON_ITR_RATE: 0.20,
};

export const TRANSACTION_SLUGS = {
  SALE_RETAIL: 'SALE_CORPORATE_INDIVIDUAL',
  PURCHASE_RETAIL: 'PURCHASE_CORPORATE_INDIVIDUAL',
  SALE_BULK: 'SALE_CORPORATE_INDIVIDUAL',
  PURCHASE_BULK: 'PURCHASE_CORPORATE_INDIVIDUAL',
  PURCHASE_CORPORATE_INDIVIDUAL: 'PURCHASE_CORPORATE_INDIVIDUAL',
  SALE_CORPORATE_INDIVIDUAL: 'SALE_CORPORATE_INDIVIDUAL',
  SALE_BULK_FFMC: 'SALE_FFMC',
  PURCHASE_BULK_FFMC: 'PURCHASE_FFMC',
  SALE_RMC: 'SALE_RMC',
  PURCHASE_RMC: 'PURCHASE_RMC',
  FAKE_CURRENCY: 'FAKE_CURRENCY',
  AD1_REMITTANCE: 'AD1',
};

export const PRODUCT_CODES = {
  CC: 'CC', // Single Currency Forex Card
  CM: 'CM', // Multi Currency Forex Card
  CN: 'CN', // Currency Notes
  TT: 'TT', // Telegraphic Transfer / Outward Remittance
  TP: 'TP', // Travellers Cheque
};

export const PAYMENT_METHODS = {
  CASH: 'CASH',
  CHEQUE: 'CHEQUE',
  BANK_TRANSFER: 'BANK_TRANSFER',
  UPI: 'UPI',
  NEFT: 'NEFT',
  RTGS: 'RTGS',
  IMPS: 'IMPS',
  CARD: 'CARD',
};

export function formatDisplayDate(d: Date = new Date()): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatIsoDate(d: Date = new Date()): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
}

