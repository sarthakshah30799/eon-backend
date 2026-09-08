import type { TransactionPassengerSnapshotValue } from "../types/transaction-snapshot.types";

type TransactionPassengerCapturePayload = {
  entityType: string;
  nationalityType: string;
  panNumber?: string | null;
  panHolderName?: string | null;
  panDob?: string | null;
  panHolderRelationType?: string | null;
  paidByPanNumber?: string | null;
  paidByPanHolderName?: string | null;
  paidByPanDob?: string | null;
  gstNumber?: string | null;
  passportPassengerName?: string | null;
  passportNumber?: string | null;
  passportIssueAt?: string | null;
  passportIssueDate?: string | null;
  passportExpiryDate?: string | null;
  arrivalDate?: string | null;
  email?: string | null;
  contactNo?: string | null;
  city?: string | null;
  address1?: string | null;
  address2?: string | null;
  isPep?: boolean | null;
};

const trimToNull = (value?: string | null) => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

/**
 * Freeze transaction-captured passenger identity on the transaction snapshot.
 * Master passenger records may be updated by later transactions; each transaction
 * must retain the values submitted for that specific transaction.
 */
export const freezeTransactionPassengerSnapshot = (
  snapshot: TransactionPassengerSnapshotValue,
  payload: TransactionPassengerCapturePayload,
): TransactionPassengerSnapshotValue => {
  if (!snapshot) {
    return snapshot;
  }

  return {
    ...snapshot,
    entityType: payload.entityType,
    nationalityType: payload.nationalityType,
    panNumber: trimToNull(payload.panNumber),
    panHolderName: trimToNull(payload.panHolderName),
    panDob: payload.panDob ?? null,
    panHolderRelationType: trimToNull(payload.panHolderRelationType),
    paidByPanNumber: trimToNull(payload.paidByPanNumber),
    paidByPanHolderName: trimToNull(payload.paidByPanHolderName),
    paidByPanDob: payload.paidByPanDob ?? null,
    gstNumber: trimToNull(payload.gstNumber),
    passportPassengerName: trimToNull(payload.passportPassengerName),
    passportNumber: trimToNull(payload.passportNumber),
    passportIssueAt: trimToNull(payload.passportIssueAt),
    passportIssueDate: payload.passportIssueDate ?? null,
    passportExpiryDate: payload.passportExpiryDate ?? null,
    arrivalDate: payload.arrivalDate ?? null,
    email: trimToNull(payload.email),
    contactNo: trimToNull(payload.contactNo),
    city: trimToNull(payload.city),
    address1: trimToNull(payload.address1),
    address2: trimToNull(payload.address2),
    isPep: Boolean(payload.isPep),
  };
};
