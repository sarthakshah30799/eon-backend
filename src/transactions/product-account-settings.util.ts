import { BadRequestException } from "@nestjs/common";
import { Product } from "../products/product.entity";

/**
 * Product Profile account roles for CARD / CM / TT / EM posting
 * (legacy intupd: SAL* / CLO* / CRD*I / PUR* / PRO*).
 */
export type ProductSaleAccountIds = {
  sellAccountId: string;
  closingAccountId: string;
  /** Issuer control — legacy CRD*I (`acOfIssuer`). */
  controlAccountId: string;
};

export type ProductSettlementAccountIds = {
  /** Issuer control — legacy CRD*I (`acOfIssuer`). */
  controlAccountId: string;
  closingAccountId: string;
  purchaseAccountId: string;
  profitAccountId: string;
};

const accountId = (
  account: { id: string } | null | undefined,
): string | null => (account?.id ? String(account.id) : null);

export const requireProductSaleAccounts = (
  product: Product,
): ProductSaleAccountIds => {
  const sellAccountId = accountId(product.saleAc);
  const closingAccountId = accountId(product.closingAc);
  const controlAccountId = accountId(product.acOfIssuer);
  const missing: string[] = [];
  if (!sellAccountId) missing.push("saleAc");
  if (!closingAccountId) missing.push("closingAc");
  if (!controlAccountId) missing.push("acOfIssuer");
  if (missing.length) {
    throw new BadRequestException(
      `Product ${product.productCode || product.id} is missing required account(s): ${missing.join(", ")}`,
    );
  }
  return {
    sellAccountId: sellAccountId!,
    closingAccountId: closingAccountId!,
    controlAccountId: controlAccountId!,
  };
};

export const requireProductSettlementAccounts = (
  product: Product,
): ProductSettlementAccountIds => {
  const controlAccountId = accountId(product.acOfIssuer);
  const closingAccountId = accountId(product.closingAc);
  const purchaseAccountId = accountId(product.purchaseAc);
  const profitAccountId = accountId(product.profitAc);
  const missing: string[] = [];
  if (!controlAccountId) missing.push("acOfIssuer");
  if (!closingAccountId) missing.push("closingAc");
  if (!purchaseAccountId) missing.push("purchaseAc");
  if (!profitAccountId) missing.push("profitAc");
  if (missing.length) {
    throw new BadRequestException(
      `Product ${product.productCode || product.id} is missing required settlement account(s): ${missing.join(", ")}`,
    );
  }
  return {
    controlAccountId: controlAccountId!,
    closingAccountId: closingAccountId!,
    purchaseAccountId: purchaseAccountId!,
    profitAccountId: profitAccountId!,
  };
};
