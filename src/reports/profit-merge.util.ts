import { DataSource, Repository } from "typeorm";
import {
  isCardProductCode,
  type ProductSnapshotLike,
} from "../card-stock/card-product.util";
import { Product } from "../products/product.entity";
import { isTtProductCode } from "../tt-deal/tt-product.util";

export type ProfitMergeAccountLike = {
  id: string;
  accountCode: string;
};

export type ProfitMergeBucket = {
  branchId: string | null;
  branchCode: string;
  accountId: string;
  openingCents: number;
  periodDebitCents: number;
  periodCreditCents: number;
};

const toText = (value: unknown) => String(value ?? "").trim();

const normalizeUpper = (value: unknown) =>
  toText(value)
    .replace(/[\s-]+/g, "_")
    .toUpperCase();

export const isPurchaseTimeProfitProduct = (product: {
  productCode?: string | null;
  productRequiresSettlement?: boolean | null;
}): boolean => {
  if (product.productRequiresSettlement === true) return true;
  if (isCardProductCode(product.productCode)) return true;
  if (isTtProductCode(product.productCode)) return true;
  return false;
};

export const isPurchaseTimeProfitSnapshot = (
  snapshot: ProductSnapshotLike & {
    productRequiresSettlement?: boolean | null;
    product_requires_settlement?: boolean | null;
  },
): boolean => {
  const flag =
    snapshot.productRequiresSettlement ??
    snapshot.product_requires_settlement;
  if (flag === true) return true;
  const code =
    snapshot.productCode ?? snapshot.product_code ?? snapshot.code ?? null;
  if (isCardProductCode(code) || isTtProductCode(code)) return true;
  return false;
};

export const isPurchaseTimeProfitSuffix = (suffix: string): boolean =>
  isCardProductCode(suffix) || isTtProductCode(suffix);

export const buildAccountByCode = <T extends ProfitMergeAccountLike>(
  accountById: Map<string, T>,
) => {
  const accountByCode = new Map<string, T>();
  for (const account of accountById.values()) {
    const code = normalizeUpper(account.accountCode);
    if (code) accountByCode.set(code, account);
  }
  return accountByCode;
};

export const pickMergeTargetAccountId = <T extends ProfitMergeAccountLike>(input: {
  purchaseTime: boolean;
  purchaseAcId?: string | null;
  saleAcId?: string | null;
  profitAccountCode?: string | null;
  accountById: Map<string, T>;
  accountByCode: Map<string, T>;
}): string | null => {
  const preferredIds = input.purchaseTime
    ? [input.purchaseAcId, input.saleAcId]
    : [input.saleAcId, input.purchaseAcId];
  for (const accountId of preferredIds) {
    if (accountId && input.accountById.has(accountId)) {
      return accountId;
    }
  }

  const profitCode = normalizeUpper(input.profitAccountCode);
  if (!profitCode.startsWith("PRO") || profitCode.length <= 3) {
    return null;
  }
  const suffix = profitCode.slice(3);
  const candidates = input.purchaseTime
    ? [`PUR${suffix}`, `SELL${suffix}`, `SAL${suffix}`]
    : [`SAL${suffix}`, `SELL${suffix}`, `PUR${suffix}`];
  for (const candidate of candidates) {
    const target = input.accountByCode.get(candidate);
    if (target) return target.id;
  }
  return null;
};

export const applyCodeBasedProfitMergeTargets = <
  T extends ProfitMergeAccountLike,
>(
  accountById: Map<string, T>,
  existing: Map<string, string>,
): Map<string, string> => {
  const map = new Map(existing);
  const accountByCode = buildAccountByCode(accountById);

  for (const account of accountById.values()) {
    if (map.has(account.id)) continue;
    const code = normalizeUpper(account.accountCode);
    if (!code.startsWith("PRO") || code.length <= 3) continue;
    const suffix = code.slice(3);
    const targetId = pickMergeTargetAccountId({
      purchaseTime: isPurchaseTimeProfitSuffix(suffix),
      profitAccountCode: code,
      accountById,
      accountByCode,
    });
    if (!targetId || targetId === account.id) continue;
    map.set(account.id, targetId);
  }

  return map;
};

export const applyProfitMergeToBuckets = <T extends ProfitMergeAccountLike>(input: {
  buckets: ProfitMergeBucket[];
  profitMergeMap: Map<string, string>;
  branchMetaById: Map<string, { code: string; label: string }>;
  accountById: Map<string, T>;
}): ProfitMergeBucket[] => {
  const keyOf = (branchId: string | null, accountId: string) =>
    `${branchId ?? "ALL"}::${accountId}`;
  const bucketMap = new Map(
    input.buckets.map((bucket) => [
      keyOf(bucket.branchId, bucket.accountId),
      { ...bucket },
    ]),
  );

  const ensure = (branchId: string | null, accountId: string) => {
    const key = keyOf(branchId, accountId);
    let bucket = bucketMap.get(key);
    if (!bucket) {
      const branchCode =
        branchId == null
          ? "ALL"
          : input.branchMetaById.get(branchId)?.code || branchId;
      bucket = {
        branchId,
        branchCode,
        accountId,
        openingCents: 0,
        periodDebitCents: 0,
        periodCreditCents: 0,
      };
      bucketMap.set(key, bucket);
    }
    return bucket;
  };

  for (const bucket of Array.from(bucketMap.values())) {
    const targetAccountId = input.profitMergeMap.get(bucket.accountId);
    if (!targetAccountId || targetAccountId === bucket.accountId) continue;
    if (!input.accountById.has(targetAccountId)) continue;

    const target = ensure(bucket.branchId, targetAccountId);
    target.openingCents += bucket.openingCents;
    target.periodDebitCents += bucket.periodDebitCents;
    target.periodCreditCents += bucket.periodCreditCents;
    bucket.openingCents = 0;
    bucket.periodDebitCents = 0;
    bucket.periodCreditCents = 0;
  }

  return Array.from(bucketMap.values()).filter((bucket) => {
    const closing =
      bucket.openingCents +
      bucket.periodDebitCents -
      bucket.periodCreditCents;
    return (
      bucket.openingCents !== 0 ||
      bucket.periodDebitCents !== 0 ||
      bucket.periodCreditCents !== 0 ||
      closing !== 0
    );
  });
};

export const collectProfitProductSnapshots = async (
  database2: DataSource,
  input: {
    branchIds: string[];
    startDate: string;
    endDate: string;
    technicalSlugs: string[];
  },
) => {
  const params: unknown[] = [input.startDate, input.endDate];
  const conditions = [
    "posting.deleted_at IS NULL",
    "tx.deleted_at IS NULL",
    "item.deleted_at IS NULL",
    "posting.source_type = 'ITEM_PROFIT'",
    "(tx.transaction_date AT TIME ZONE 'UTC')::date >= $1::date",
    "(tx.transaction_date AT TIME ZONE 'UTC')::date <= $2::date",
  ];

  if (input.branchIds.length) {
    params.push(input.branchIds);
    conditions.push(`tx.branch_id = ANY($${params.length}::uuid[])`);
  }

  const rows = (await database2.query(
    `SELECT
        posting.account_id AS "accountId",
        item.product_snapshot AS "productSnapshot",
        tx.slug AS "documentSlug"
      FROM transaction_account_postings posting
      INNER JOIN transactions tx ON tx.id = posting.transaction_id
      INNER JOIN transaction_items item ON item.id = posting.source_id
      WHERE ${conditions.join(" AND ")}`,
    params,
  )) as Array<Record<string, unknown>>;

  const technical = new Set(
    input.technicalSlugs.map((slug) => normalizeUpper(slug)),
  );

  return rows
    .filter((row) => !technical.has(normalizeUpper(row.documentSlug)))
    .map((row) => ({
      accountId: toText(row.accountId),
      productSnapshot: row.productSnapshot as ProductSnapshotLike | null,
    }));
};

export const resolveProfitMergeTargetsFromProducts = async <
  T extends ProfitMergeAccountLike,
>(input: {
  productRepository: Repository<Product>;
  database2: DataSource;
  branchIds: string[];
  startDate: string;
  endDate: string;
  accountById: Map<string, T>;
  technicalSlugs: string[];
}): Promise<Map<string, string>> => {
  const products = await input.productRepository.find({
    relations: ["profitAc", "saleAc", "purchaseAc"],
  });
  const accountByCode = buildAccountByCode(input.accountById);

  const byProductId = new Map<
    string,
    {
      profitAcId: string | null;
      saleAcId: string | null;
      purchaseAcId: string | null;
      purchaseTime: boolean;
      productCode: string;
      profitAccountCode: string;
    }
  >();
  const byProductCode = new Map<string, string>();
  const map = new Map<string, string>();

  for (const product of products) {
    const profitAcId = product.profitAc?.id ?? null;
    const saleAcId = product.saleAc?.id ?? null;
    const purchaseAcId = product.purchaseAc?.id ?? null;
    const purchaseTime = isPurchaseTimeProfitProduct(product);
    const productCode = toText(product.productCode);
    const profitAccountCode = toText(product.profitAc?.accountCode);
    byProductId.set(product.id, {
      profitAcId,
      saleAcId,
      purchaseAcId,
      purchaseTime,
      productCode,
      profitAccountCode,
    });
    if (productCode) {
      byProductCode.set(normalizeUpper(productCode), product.id);
    }
    if (!profitAcId || !input.accountById.has(profitAcId)) continue;
    const targetId = pickMergeTargetAccountId({
      purchaseTime,
      purchaseAcId,
      saleAcId,
      profitAccountCode:
        profitAccountCode || input.accountById.get(profitAcId)?.accountCode,
      accountById: input.accountById,
      accountByCode,
    });
    if (!targetId || targetId === profitAcId) continue;
    map.set(profitAcId, targetId);
  }

  const snapshotRows = await collectProfitProductSnapshots(input.database2, {
    branchIds: input.branchIds,
    startDate: input.startDate,
    endDate: input.endDate,
    technicalSlugs: input.technicalSlugs,
  });

  for (const row of snapshotRows) {
    const snapshot = row.productSnapshot;
    if (!snapshot || typeof snapshot !== "object") continue;

    const snapshotRecord = snapshot as ProductSnapshotLike & {
      id?: string | null;
      productId?: string | null;
      product_id?: string | null;
      productRequiresSettlement?: boolean | null;
      product_requires_settlement?: boolean | null;
    };
    const productId =
      toText(snapshotRecord.productId) ||
      toText(snapshotRecord.product_id) ||
      toText(snapshotRecord.id) ||
      byProductCode.get(
        normalizeUpper(
          snapshotRecord.productCode ??
            snapshotRecord.product_code ??
            snapshotRecord.code,
        ),
      ) ||
      "";
    const product = productId ? byProductId.get(productId) : undefined;
    const purchaseTime = product
      ? product.purchaseTime || isPurchaseTimeProfitSnapshot(snapshotRecord)
      : isPurchaseTimeProfitSnapshot(snapshotRecord);
    const profitAcId = product?.profitAcId || row.accountId;
    if (!profitAcId || !input.accountById.has(profitAcId)) continue;
    const targetId = pickMergeTargetAccountId({
      purchaseTime,
      purchaseAcId: product?.purchaseAcId,
      saleAcId: product?.saleAcId,
      profitAccountCode:
        product?.profitAccountCode ||
        input.accountById.get(profitAcId)?.accountCode,
      accountById: input.accountById,
      accountByCode,
    });
    if (!targetId || targetId === profitAcId) continue;
    map.set(profitAcId, targetId);
  }

  return map;
};
