import { TransactionType } from "../transactions.enums";
import { TransactionReferenceSnapshotValue } from "./transaction-snapshot.types";

export type TransactionTaxSplitMode = "IGST" | "CGST_SGST" | "NONE";

export interface TransactionTaxLineInput {
  quantity?: string | number | null;
  rate?: string | number | null;
}

export interface TransactionAdditionalChargeTaxLineInput {
  amount?: string | number | null;
  applyTax?: boolean | null;
}

export interface TransactionTaxCalculationInput {
  transactionType: TransactionType;
  branchSnapshot?: TransactionReferenceSnapshotValue;
  partyProfileSnapshot?: TransactionReferenceSnapshotValue;
  partyProfileApplyTax?: boolean;
  gstRatePercent?: string | number | null;
  items?: TransactionTaxLineInput[];
  additionalCharges?: TransactionAdditionalChargeTaxLineInput[];
}

export interface TransactionTaxComponentBreakdown {
  igstAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstRatePercent: string;
  cgstRatePercent: string;
  sgstRatePercent: string;
  splitMode: TransactionTaxSplitMode;
}

export interface TransactionTaxSummary extends TransactionTaxComponentBreakdown {
  itemBaseAmount: string;
  itemTaxAmount: string;
  additionalChargeBaseAmount: string;
  additionalChargeTaxAmount: string;
  totalTaxAmount: string;
  finalAmount: string;
  branchStateName: string | null;
  partyStateName: string | null;
  additionalChargeRows: Array<{
    lineNo: number;
    amount: string;
    gstRatePercent: string;
    gstAmount: string;
    totalAmount: string;
  }>;
}
