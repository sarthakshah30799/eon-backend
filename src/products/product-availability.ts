import { BadRequestException } from "@nestjs/common";
import { TradeMode, TransactionType } from "../transactions/transactions.enums";
import { Product } from "./product.entity";

export type ProductAvailabilityKind =
  | "sale_purchase"
  | "other_transaction"
  | "deal_cover";

export type ProductAvailabilityContext =
  | {
      kind: "sale_purchase";
      transactionType: TransactionType;
      tradeMode: TradeMode;
    }
  | { kind: "other_transaction" }
  | { kind: "deal_cover" };

export type ProductAvailabilityFlag =
  | "availableInRetailBuying"
  | "availableInRetailSelling"
  | "availableInBulkBuying"
  | "availableInBulkSelling"
  | "availableInOtherTransaction"
  | "availableInDealCover";

export const getProductAvailabilityFlag = (
  context: ProductAvailabilityContext,
): ProductAvailabilityFlag => {
  if (context.kind === "other_transaction") {
    return "availableInOtherTransaction";
  }
  if (context.kind === "deal_cover") {
    return "availableInDealCover";
  }

  const isSale = context.transactionType === TransactionType.SALE;
  const isRetail = context.tradeMode === TradeMode.RETAIL;

  if (isSale && isRetail) return "availableInRetailSelling";
  if (isSale) return "availableInBulkSelling";
  if (isRetail) return "availableInRetailBuying";
  return "availableInBulkBuying";
};

export const assertProductAvailableForContext = (
  product: Pick<Product, "productCode" | ProductAvailabilityFlag>,
  context: ProductAvailabilityContext,
): void => {
  const flag = getProductAvailabilityFlag(context);
  if (product[flag] !== true) {
    throw new BadRequestException(
      `Product ${product.productCode || "unknown"} is not available for this transaction (${flag} required)`,
    );
  }
};
