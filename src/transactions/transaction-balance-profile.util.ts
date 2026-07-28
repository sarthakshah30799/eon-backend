import { ClientType } from "../party-profiles/party-profile.entity";
import { TradeMode } from "./transactions.enums";

export function normalizeBalanceProfileType(value: unknown): string {
  const normalized = String(value ?? "").trim().toUpperCase();

  if (normalized === ClientType.FFMC || normalized === "FFMC") {
    return "FFMC";
  }

  if (normalized === ClientType.RMC || normalized === "RMC") {
    return "RMC";
  }

  if (
    normalized === "FOREX" ||
    normalized === ClientType.FOREX_CORRESPONDENT ||
    normalized === ClientType.FOREIGN_CORRESPONDENT
  ) {
    return "FOREX";
  }

  return "CORPORATE";
}

export function resolveCurrencyBalanceTradeMode(value: unknown) {
  return normalizeBalanceProfileType(value) === "CORPORATE"
    ? TradeMode.RETAIL
    : TradeMode.BULK;
}
