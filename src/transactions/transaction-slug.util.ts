import { PurposePartyProfileType } from "../purpose/purpose.enums";
import { PassengerEntityType } from "../passengers/passenger.entity";
import {
  TransactionPartyProfileTypeEnum,
  TransactionTypeProfileEnum,
} from "./transactions.enums";

export function normalizeTransactionSlug(slug?: string | null): string {
  return String(slug ?? "")
    .trim()
    .toUpperCase()
    .replace(/-/g, "_");
}

export function isCorporateIndividualTransactionSlug(
  slug?: string | null,
): boolean {
  const normalizedSlug = normalizeTransactionSlug(slug);
  if (!normalizedSlug) {
    return false;
  }

  return (
    normalizedSlug ===
      TransactionTypeProfileEnum.PURCHASE_CORPORATE_INDIVIDUAL ||
    normalizedSlug === TransactionTypeProfileEnum.SALE_CORPORATE_INDIVIDUAL ||
    normalizedSlug.includes("CORPORATE_INDIVIDUAL") ||
    normalizedSlug === "CORPORATE" ||
    normalizedSlug === "INDIVIDUAL"
  );
}

export function isCorporateIndividualPartyProfileType(
  value?: string | null,
): boolean {
  const normalized = String(value ?? "").trim().toUpperCase();
  return (
    normalized === PurposePartyProfileType.CORPORATE ||
    normalized === PurposePartyProfileType.INDIVIDUAL ||
    normalized === TransactionPartyProfileTypeEnum.CORPORATE ||
    normalized === TransactionPartyProfileTypeEnum.INDIVIDUAL
  );
}

export function isCorporateIndividualPassengerEntityType(
  value?: string | null,
): boolean {
  const normalized = String(value ?? "").trim().toUpperCase();
  return (
    normalized === PassengerEntityType.CORPORATE ||
    normalized === PassengerEntityType.INDIVIDUAL
  );
}

export function isCorporateIndividualTransactionContext(
  slug?: string | null,
  transactionPartyProfileType?: string | null,
  passengerEntityType?: string | null,
): boolean {
  return (
    isCorporateIndividualTransactionSlug(slug) ||
    isCorporateIndividualPartyProfileType(transactionPartyProfileType) ||
    isCorporateIndividualPassengerEntityType(passengerEntityType)
  );
}
