import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Fill-empty Product Profile account FKs from legacy TRANSACTION_ACCOUNTING
 * Adv Settings five-tuples (CARD/CM/TT). Does not overwrite non-null product FKs.
 * Deactivates the Adv Settings rows after backfill (UI registry no longer lists them).
 */
type SettingRow = { code: string; value_text: string | null };

const PRODUCT_SETTING_MAP: Array<{
  productCode: string;
  sell: string;
  closing: string;
  control: string;
  purchase: string;
  profit: string;
}> = [
  {
    productCode: "CC",
    sell: "CARD_SELL_CONTROL_ACCOUNT",
    closing: "CARD_CLOSING_CONTROL_ACCOUNT",
    control: "CARD_CONTROL_ACCOUNT",
    purchase: "CARD_PURCHASE_CONTROL_ACCOUNT",
    profit: "CARD_PROFIT_CONTROL_ACCOUNT",
  },
  {
    productCode: "CM",
    sell: "CM_SELL_CONTROL_ACCOUNT",
    closing: "CM_CLOSING_CONTROL_ACCOUNT",
    control: "CM_CONTROL_ACCOUNT",
    purchase: "CM_PURCHASE_CONTROL_ACCOUNT",
    profit: "CM_PROFIT_CONTROL_ACCOUNT",
  },
  {
    productCode: "TT",
    sell: "TT_SELL_CONTROL_ACCOUNT",
    closing: "TT_CLOSING_CONTROL_ACCOUNT",
    control: "TT_CONTROL_ACCOUNT",
    purchase: "TT_PURCHASE_CONTROL_ACCOUNT",
    profit: "TT_PROFIT_CONTROL_ACCOUNT",
  },
];

const ALL_PRODUCT_SETTING_CODES = PRODUCT_SETTING_MAP.flatMap((entry) => [
  entry.sell,
  entry.closing,
  entry.control,
  entry.purchase,
  entry.profit,
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class BackfillProductAccountsFromAdvSettings1790751654108
  implements MigrationInterface
{
  name = "BackfillProductAccountsFromAdvSettings1790751654108";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const settings = (await queryRunner.query(
      `
      SELECT UPPER(TRIM(code::text)) AS code, value_text
      FROM advanced_settings
      WHERE node_type = 'setting'
        AND UPPER(TRIM(code::text)) = ANY($1)
      `,
      [ALL_PRODUCT_SETTING_CODES],
    )) as SettingRow[];

    const settingValueByCode = new Map<string, string>();
    for (const row of settings) {
      const value = String(row.value_text ?? "").trim();
      if (value && UUID_RE.test(value)) {
        settingValueByCode.set(String(row.code).toUpperCase(), value);
      }
    }

    const validAccountIds = new Set<string>(
      (
        await queryRunner.query(
          `
          SELECT id::text AS id
          FROM account_profiles
          WHERE id::text = ANY($1)
          `,
          [[...new Set(settingValueByCode.values())]],
        )
      ).map((row: { id: string }) => String(row.id)),
    );

    for (const entry of PRODUCT_SETTING_MAP) {
      const sell = settingValueByCode.get(entry.sell);
      const closing = settingValueByCode.get(entry.closing);
      const control = settingValueByCode.get(entry.control);
      const purchase = settingValueByCode.get(entry.purchase);
      const profit = settingValueByCode.get(entry.profit);

      if (sell && validAccountIds.has(sell)) {
        await queryRunner.query(
          `
          UPDATE products
          SET sale_ac_id = $1::uuid
          WHERE UPPER(TRIM(product_code::text)) = $2
            AND sale_ac_id IS NULL
          `,
          [sell, entry.productCode],
        );
      }
      if (closing && validAccountIds.has(closing)) {
        await queryRunner.query(
          `
          UPDATE products
          SET closing_ac_id = $1::uuid
          WHERE UPPER(TRIM(product_code::text)) = $2
            AND closing_ac_id IS NULL
          `,
          [closing, entry.productCode],
        );
      }
      if (control && validAccountIds.has(control)) {
        await queryRunner.query(
          `
          UPDATE products
          SET ac_of_issuer_id = $1::uuid
          WHERE UPPER(TRIM(product_code::text)) = $2
            AND ac_of_issuer_id IS NULL
          `,
          [control, entry.productCode],
        );
      }
      if (purchase && validAccountIds.has(purchase)) {
        await queryRunner.query(
          `
          UPDATE products
          SET purchase_ac_id = $1::uuid
          WHERE UPPER(TRIM(product_code::text)) = $2
            AND purchase_ac_id IS NULL
          `,
          [purchase, entry.productCode],
        );
      }
      if (profit && validAccountIds.has(profit)) {
        await queryRunner.query(
          `
          UPDATE products
          SET profit_ac_id = $1::uuid
          WHERE UPPER(TRIM(product_code::text)) = $2
            AND profit_ac_id IS NULL
          `,
          [profit, entry.productCode],
        );
      }
    }

    await queryRunner.query(
      `
      UPDATE advanced_settings
      SET is_active = false
      WHERE node_type = 'setting'
        AND UPPER(TRIM(code::text)) = ANY($1)
      `,
      [ALL_PRODUCT_SETTING_CODES],
    );

    const gaps = (await queryRunner.query(
      `
      SELECT product_code,
             CASE WHEN sale_ac_id IS NULL THEN 'saleAc' END AS sale_gap,
             CASE WHEN closing_ac_id IS NULL THEN 'closingAc' END AS closing_gap,
             CASE WHEN ac_of_issuer_id IS NULL THEN 'acOfIssuer' END AS issuer_gap,
             CASE WHEN purchase_ac_id IS NULL THEN 'purchaseAc' END AS purchase_gap,
             CASE WHEN profit_ac_id IS NULL THEN 'profitAc' END AS profit_gap
      FROM products
      WHERE UPPER(TRIM(product_code::text)) IN ('CC', 'CM', 'TT', 'EM')
        AND (
          sale_ac_id IS NULL
          OR closing_ac_id IS NULL
          OR ac_of_issuer_id IS NULL
          OR purchase_ac_id IS NULL
          OR profit_ac_id IS NULL
        )
      ORDER BY product_code
      `,
    )) as Array<{
      product_code: string;
      sale_gap: string | null;
      closing_gap: string | null;
      issuer_gap: string | null;
      purchase_gap: string | null;
      profit_gap: string | null;
    }>;

    for (const gap of gaps) {
      const missing = [
        gap.sale_gap,
        gap.closing_gap,
        gap.issuer_gap,
        gap.purchase_gap,
        gap.profit_gap,
      ].filter(Boolean);
      console.warn(
        `[backfill-product-accounts] product ${gap.product_code} still missing: ${missing.join(", ")}`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      UPDATE advanced_settings
      SET is_active = true
      WHERE node_type = 'setting'
        AND UPPER(TRIM(code::text)) = ANY($1)
      `,
      [ALL_PRODUCT_SETTING_CODES],
    );
    // Fill-empty backfill is not reversed (would require knowing which FKs were empty).
  }
}
