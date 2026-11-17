import { BadRequestException } from "@nestjs/common";
import { roundToScale } from "./transaction-accounting.util";

export interface StockValidationItem {
  currencyId: string;
  productId: string;
  quantity: number | string;
  currencyCode?: string | null;
  productCode?: string | null;
}

export interface QuantityAvailabilityDetails {
  branchId: string;
  counterId: string;
  currencyId: string;
  productId: string;
  purchasedQuantity: string;
  soldQuantity: string;
  draftSaleQuantity?: string;
  heldTransferQuantity?: string;
  availableQuantity: string;
}

export type QuantityAvailabilityChecker = (
  branchId: string,
  counterId: string,
  currencyId: string,
  productId: string,
  excludeTransactionId?: string,
  excludeTransferId?: string,
) => Promise<QuantityAvailabilityDetails>;

/**
 * Validates that requested quantities for currency items do not exceed available stock on the counter.
 * Aggregates items with duplicate (currencyId, productId) into a single check.
 */
export async function assertAvailableCounterStock(
  checkAvailability: QuantityAvailabilityChecker,
  params: {
    branchId: string;
    counterId: string;
    items: StockValidationItem[];
    excludeTransactionId?: string;
    excludeTransferId?: string;
  },
): Promise<void> {
  const {
    branchId,
    counterId,
    items,
    excludeTransactionId,
    excludeTransferId,
  } = params;
  if (!items || items.length === 0) return;

  const grouped = new Map<
    string,
    { currencyId: string; productId: string; quantity: number; label: string }
  >();

  for (const item of items) {
    const qty = Number(item.quantity ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const currencyId = String(item.currencyId ?? "").trim();
    const productId = String(item.productId ?? "").trim();
    if (!currencyId || !productId) continue;

    const key = `${currencyId}:${productId}`;
    const label = item.currencyCode
      ? `${item.currencyCode}${item.productCode ? ` (${item.productCode})` : ""}`
      : "";
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += qty;
    } else {
      grouped.set(key, {
        currencyId,
        productId,
        quantity: qty,
        label,
      });
    }
  }

  for (const group of grouped.values()) {
    const availability = await checkAvailability(
      branchId,
      counterId,
      group.currencyId,
      group.productId,
      excludeTransactionId,
      excludeTransferId,
    );

    const available = Number(availability.availableQuantity ?? 0);
    if (group.quantity > available) {
      const formattedAvailable = roundToScale(Math.max(0, available), 7);
      const formattedRequested = roundToScale(group.quantity, 7);
      const itemLabel = group.label ? ` for ${group.label}` : "";
      throw new BadRequestException(
        `Requested quantity ${formattedRequested} exceeds available counter stock of ${formattedAvailable}${itemLabel}`,
      );
    }
  }
}

