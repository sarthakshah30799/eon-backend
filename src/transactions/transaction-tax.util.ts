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

const calculateChargeTaxAmount = (baseAmount: number, taxRatePercent: number) =>
  (baseAmount * taxRatePercent) / 100;

const calculateItemTaxableAmount = (baseAmount: number) => {
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

const buildComponentBreakdown = (
  itemTaxableAmount: number,
  additionalChargeBaseAmount: number,
  itemTaxAmount: number,
  additionalChargeTaxAmount: number,
  splitMode: TransactionTaxSplitMode,
  taxRatePercent: number,
): TransactionTaxComponentBreakdown => {
  const totalTaxAmount = toMoney(itemTaxAmount + additionalChargeTaxAmount);

  if (totalTaxAmount <= 0) {
    return {
      splitMode: null,
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

  const halfRate = taxRatePercent / 2;
  const itemCgst = toMoney(calculateChargeTaxAmount(itemTaxableAmount, halfRate));
  const itemSgst = toMoney(calculateChargeTaxAmount(itemTaxableAmount, halfRate));
  const chargeCgst = toMoney(calculateChargeTaxAmount(additionalChargeBaseAmount, halfRate));
  const chargeSgst = toMoney(calculateChargeTaxAmount(additionalChargeBaseAmount, halfRate));
  return {
    splitMode,
    igstAmount: "0.00",
    cgstAmount: roundMoney(itemCgst + chargeCgst),
    sgstAmount: roundMoney(itemSgst + chargeSgst),
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
  const splitMode = applyTax ? resolveSplitMode(branchStateName, partyStateName) : null;

  const itemBaseAmount = items.reduce((sum, row) => {
    const quantity = toNumber(row.quantity);
    const rate = toNumber(row.rate);
    return sum + toMoney(quantity * rate);
  }, 0);

  const additionalChargeBaseAmount = additionalCharges.reduce((sum, row) => {
    const amount = toNumber(row.amount);
    return sum + toMoney(amount);
  }, 0);

  const itemTaxableAmount = calculateItemTaxableAmount(itemBaseAmount);
  const itemTaxAmount = applyTax
    ? toMoney(calculateChargeTaxAmount(itemTaxableAmount, gstRatePercent))
    : 0;
  const itemRows = items.map((row, index) => {
    const quantity = toNumber(row.quantity);
    const rate = toNumber(row.rate);
    const rowBaseAmount = toMoney(quantity * rate);
    const rowTaxableAmount = applyTax ? rowBaseAmount : 0;
    const rowTaxAmount = applyTax
      ? toMoney(calculateChargeTaxAmount(rowTaxableAmount, gstRatePercent))
      : 0;
    const rowSplitMode: Exclude<TransactionTaxSplitMode, null> =
      splitMode === "IGST" ? "IGST" : "CGST_SGST";

    return {
      lineNo: index + 1,
      taxableAmount: roundMoney(rowTaxableAmount),
      taxRatePercent: roundMoney(applyTax ? gstRatePercent : 0),
      gstAmount: roundMoney(rowTaxAmount),
      igstRatePercent:
        applyTax && rowSplitMode === "IGST" ? roundMoney(gstRatePercent) : "0.00",
      cgstRatePercent:
        applyTax && rowSplitMode !== "IGST" ? roundMoney(gstRatePercent / 2) : "0.00",
      sgstRatePercent:
        applyTax && rowSplitMode !== "IGST" ? roundMoney(gstRatePercent / 2) : "0.00",
      igstAmount:
        applyTax && rowSplitMode === "IGST" ? roundMoney(rowTaxAmount) : "0.00",
      cgstAmount:
        applyTax && rowSplitMode !== "IGST"
          ? roundMoney(calculateChargeTaxAmount(rowTaxableAmount, gstRatePercent / 2))
          : "0.00",
      sgstAmount:
        applyTax && rowSplitMode !== "IGST"
          ? roundMoney(calculateChargeTaxAmount(rowTaxableAmount, gstRatePercent / 2))
          : "0.00",
      splitMode: applyTax ? rowSplitMode : null,
    };
  });
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
    const rowHalfRate = gstRatePercent / 2;
    const gstAmount = rowAppliesTax
      ? toMoney(calculateChargeTaxAmount(amount, gstRatePercent))
      : 0;
    const igstAmount =
      rowAppliesTax && splitMode === "IGST"
        ? gstAmount
        : 0;
    const cgstAmount =
      rowAppliesTax && splitMode !== "IGST"
        ? toMoney(calculateChargeTaxAmount(amount, rowHalfRate))
        : 0;
    const sgstAmount =
      rowAppliesTax && splitMode !== "IGST"
        ? toMoney(calculateChargeTaxAmount(amount, rowHalfRate))
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
      igstAmount: roundMoney(igstAmount),
      cgstAmount: roundMoney(cgstAmount),
      sgstAmount: roundMoney(sgstAmount),
      igstRatePercent: rowAppliesTax && splitMode === "IGST" ? roundMoney(gstRatePercent) : "0.00",
      cgstRatePercent: rowAppliesTax && splitMode !== "IGST" ? roundMoney(rowHalfRate) : "0.00",
      sgstRatePercent: rowAppliesTax && splitMode !== "IGST" ? roundMoney(rowHalfRate) : "0.00",
      totalAmount: roundMoney(signedTotalAmount),
    };
  });

  const totalTaxAmount = toMoney(itemTaxAmount + additionalChargeTaxAmount);
  const componentBreakdown = buildComponentBreakdown(
    itemTaxableAmount,
    additionalChargeBaseAmount,
    itemTaxAmount,
    additionalChargeTaxAmount,
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
    itemTaxableAmount: roundMoney(itemTaxableAmount),
    itemTaxAmount: roundMoney(itemTaxAmount),
    itemIgstAmount: componentBreakdown.igstAmount,
    itemCgstAmount: componentBreakdown.cgstAmount,
    itemSgstAmount: componentBreakdown.sgstAmount,
    itemIgstRatePercent: componentBreakdown.igstRatePercent,
    itemCgstRatePercent: componentBreakdown.cgstRatePercent,
    itemSgstRatePercent: componentBreakdown.sgstRatePercent,
    additionalChargeBaseAmount: roundMoney(additionalChargeBaseAmount),
    additionalChargeTaxAmount: roundMoney(additionalChargeTaxAmount),
    totalTaxAmount: roundMoney(totalTaxAmount),
    finalAmount: roundMoney(finalAmount),
    branchStateName,
    partyStateName,
    itemRows,
    additionalChargeRows,
    ...componentBreakdown,
  };
}
