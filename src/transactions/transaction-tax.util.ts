import { roundMoney } from "./transaction-accounting.util";
import {
  TransactionTaxCalculationInput,
  TransactionTaxComponentBreakdown,
  TransactionTaxSplitMode,
  TransactionTaxSummary,
} from "./types/transaction-tax.types";
import { TransactionType } from "./transactions.enums";

const normalizeText = (value: unknown) =>
  String(value ?? "").trim().toUpperCase();

const toNumber = (value: unknown) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

const toMoney = (value: number) => Number(roundMoney(value));

const getSnapshotStateName = (snapshot: Record<string, unknown> | null | undefined) => {
  if (!snapshot) {
    return null;
  }

  const candidateKeys = [
    "gstStateName",
    "stateName",
    "gstState",
    "state",
    "name",
    "label",
    "code",
  ];

  for (const key of candidateKeys) {
    const value = snapshot[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const resolveSplitMode = (
  branchStateName: string | null,
  partyStateName: string | null,
): TransactionTaxSplitMode => {
  if (!branchStateName || !partyStateName) {
    return "CGST_SGST";
  }

  return normalizeText(branchStateName) === normalizeText(partyStateName)
    ? "CGST_SGST"
    : "IGST";
};

const splitMoney = (amount: number) => {
  const firstHalf = toMoney(amount / 2);
  const secondHalf = toMoney(amount - firstHalf);
  return {
    firstHalf: roundMoney(firstHalf),
    secondHalf: roundMoney(secondHalf),
  };
};

const calculateItemTaxAmount = (baseAmount: number) => {
  if (baseAmount <= 25000) {
    return 250;
  }

  if (baseAmount > 25000 && baseAmount <= 100000) {
    return baseAmount * 0.01;
  }

  if (baseAmount > 100000 && baseAmount < 1000000) {
    return 1000 + ((baseAmount - 100000) * 0.5) / 100;
  }

  return 5500 + ((baseAmount - 1000000) * 0.1) / 100;
};

const calculateChargeTaxAmount = (baseAmount: number, taxRatePercent: number) =>
  (baseAmount * taxRatePercent) / 100;

const buildComponentBreakdown = (
  totalTaxAmount: number,
  splitMode: TransactionTaxSplitMode,
  taxRatePercent: number,
): TransactionTaxComponentBreakdown => {
  if (totalTaxAmount <= 0) {
    return {
      splitMode: "NONE",
      igstAmount: "0.00",
      cgstAmount: "0.00",
      sgstAmount: "0.00",
      igstRatePercent: "0.00",
      cgstRatePercent: "0.00",
      sgstRatePercent: "0.00",
    };
  }

  if (splitMode === "IGST") {
    return {
      splitMode,
      igstAmount: roundMoney(totalTaxAmount),
      cgstAmount: "0.00",
      sgstAmount: "0.00",
      igstRatePercent: roundMoney(taxRatePercent),
      cgstRatePercent: "0.00",
      sgstRatePercent: "0.00",
    };
  }

  const { firstHalf, secondHalf } = splitMoney(totalTaxAmount);
  const halfRate = taxRatePercent / 2;
  return {
    splitMode,
    igstAmount: "0.00",
    cgstAmount: firstHalf,
    sgstAmount: secondHalf,
    igstRatePercent: "0.00",
    cgstRatePercent: roundMoney(halfRate),
    sgstRatePercent: roundMoney(halfRate),
  };
};

export function calculateTransactionTaxSummary(
  input: TransactionTaxCalculationInput,
): TransactionTaxSummary {
  const items = Array.isArray(input.items) ? input.items : [];
  const additionalCharges = Array.isArray(input.additionalCharges)
    ? input.additionalCharges
    : [];
  const applyTax = Boolean(input.partyProfileApplyTax);
  const gstRatePercent = Math.max(0, toNumber(input.gstRatePercent));
  const branchStateName = getSnapshotStateName(input.branchSnapshot);
  const partyStateName =
    getSnapshotStateName(input.partyProfileSnapshot) ?? null;
  const splitMode = resolveSplitMode(branchStateName, partyStateName);

  const itemBaseAmount = items.reduce((sum, row) => {
    const quantity = toNumber(row.quantity);
    const rate = toNumber(row.rate);
    return sum + toMoney(quantity * rate);
  }, 0);

  const additionalChargeBaseAmount = additionalCharges.reduce((sum, row) => {
    const amount = toNumber(row.amount);
    return sum + toMoney(amount);
  }, 0);

  const itemTaxAmount = applyTax ? calculateItemTaxAmount(itemBaseAmount) : 0;
  const additionalChargeTaxAmount = applyTax
    ? additionalCharges.reduce((sum, row) => {
        if (row.applyTax === false) {
          return sum;
        }

        const amount = toNumber(row.amount);
        return sum + toMoney(calculateChargeTaxAmount(amount, gstRatePercent));
      }, 0)
    : 0;
  const additionalChargeRows = additionalCharges.map((row, index) => {
    const amount = toNumber(row.amount);
    const rowAppliesTax = applyTax && row.applyTax !== false;
    const gstAmount = rowAppliesTax
      ? toMoney(calculateChargeTaxAmount(amount, gstRatePercent))
      : 0;
    const signedTotalAmount =
      input.transactionType === TransactionType.PURCHASE
        ? -(amount + gstAmount)
        : amount + gstAmount;

    return {
      lineNo: index + 1,
      amount: roundMoney(amount),
      gstRatePercent: roundMoney(gstRatePercent),
      gstAmount: roundMoney(gstAmount),
      totalAmount: roundMoney(signedTotalAmount),
    };
  });

  const totalTaxAmount = toMoney(itemTaxAmount + additionalChargeTaxAmount);
  const componentBreakdown = buildComponentBreakdown(
    totalTaxAmount,
    splitMode,
    gstRatePercent,
  );

  const totalBaseAmount = toMoney(itemBaseAmount + additionalChargeBaseAmount);
  const finalAmount =
    input.transactionType === TransactionType.SALE
      ? toMoney(totalBaseAmount + totalTaxAmount)
      : toMoney(totalBaseAmount - totalTaxAmount);

  return {
    itemBaseAmount: roundMoney(itemBaseAmount),
    itemTaxAmount: roundMoney(itemTaxAmount),
    additionalChargeBaseAmount: roundMoney(additionalChargeBaseAmount),
    additionalChargeTaxAmount: roundMoney(additionalChargeTaxAmount),
    totalTaxAmount: roundMoney(totalTaxAmount),
    finalAmount: roundMoney(finalAmount),
    branchStateName,
    partyStateName,
    additionalChargeRows,
    ...componentBreakdown,
  };
}
