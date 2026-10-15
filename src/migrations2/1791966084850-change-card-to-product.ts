import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Data-preserving rename of card_stock_* / card_transfer_* tables to product_*.
 * Rewrites PL/pgSQL bodies that hardcode old table names.
 * Do NOT use migration:generate for this — it emits CREATE TABLE and drops data.
 */
export class ChangeCardToProduct1791966084850 implements MigrationInterface {
  name = "ChangeCardToProduct1791966084850";

  private readonly tableRenames: Array<[string, string]> = [
    ["card_stock_transaction_entries", "product_stock_transaction_entries"],
    ["card_transfer_request_cards", "product_transfer_request_products"],
    ["card_transfer_request_items", "product_transfer_request_items"],
    ["card_stock_receipt_items", "product_stock_receipt_items"],
    ["card_transfer_requests", "product_transfer_requests"],
    ["card_stock_receipts", "product_stock_receipts"],
    ["card_stock_cards", "product_stock_products"],
    ["card_stock_balance", "product_stock_balance"],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.card_stock_cards') IS NULL THEN
          RAISE EXCEPTION 'card_stock_cards not found — cannot rename';
        END IF;
        IF to_regclass('public.product_stock_products') IS NOT NULL THEN
          RAISE EXCEPTION 'product_stock_products already exists — cannot rename';
        END IF;
      END $$;
    `);

    for (const [from, to] of this.tableRenames) {
      await queryRunner.query(`ALTER TABLE "${from}" RENAME TO "${to}"`);
    }

    await queryRunner.query(`
      DO $$
      DECLARE
        r record;
        new_name text;
      BEGIN
        FOR r IN
          SELECT c.conname, t.relname
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = 'public'
            AND (
              c.conname LIKE '%card_stock_%'
              OR c.conname LIKE '%card_transfer_%'
            )
            AND c.conname NOT LIKE '%card_stock_settlement%'
        LOOP
          new_name := r.conname;
          new_name := replace(new_name, 'card_stock_transaction_entries', 'product_stock_transaction_entries');
          new_name := replace(new_name, 'card_transfer_request_cards', 'product_transfer_request_products');
          new_name := replace(new_name, 'card_transfer_request_items', 'product_transfer_request_items');
          new_name := replace(new_name, 'card_stock_receipt_items', 'product_stock_receipt_items');
          new_name := replace(new_name, 'card_transfer_requests', 'product_transfer_requests');
          new_name := replace(new_name, 'card_stock_receipts', 'product_stock_receipts');
          new_name := replace(new_name, 'card_stock_cards', 'product_stock_products');
          new_name := replace(new_name, 'card_stock_balance', 'product_stock_balance');
          new_name := replace(new_name, 'card_stock_entries', 'product_stock_entries');
          IF new_name <> r.conname THEN
            EXECUTE format(
              'ALTER TABLE %I RENAME CONSTRAINT %I TO %I',
              r.relname,
              r.conname,
              new_name
            );
          END IF;
        END LOOP;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        r record;
        new_name text;
      BEGIN
        FOR r IN
          SELECT indexname
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND (
              indexname LIKE '%card_stock_%'
              OR indexname LIKE '%card_transfer_%'
            )
            AND indexname NOT LIKE '%card_stock_settlement%'
        LOOP
          new_name := r.indexname;
          new_name := replace(new_name, 'card_stock_transaction_entries', 'product_stock_transaction_entries');
          new_name := replace(new_name, 'card_transfer_request_cards', 'product_transfer_request_products');
          new_name := replace(new_name, 'card_transfer_request_items', 'product_transfer_request_items');
          new_name := replace(new_name, 'card_stock_receipt_items', 'product_stock_receipt_items');
          new_name := replace(new_name, 'card_transfer_requests', 'product_transfer_requests');
          new_name := replace(new_name, 'card_stock_receipts', 'product_stock_receipts');
          new_name := replace(new_name, 'card_stock_cards', 'product_stock_products');
          new_name := replace(new_name, 'card_stock_balance', 'product_stock_balance');
          new_name := replace(new_name, 'card_stock_entries', 'product_stock_entries');
          IF new_name <> r.indexname THEN
            EXECUTE format('ALTER INDEX %I RENAME TO %I', r.indexname, new_name);
          END IF;
        END LOOP;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        r record;
        function_definition text;
      BEGIN
        FOR r IN
          SELECT p.oid::regprocedure AS signature
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public'
            AND p.prokind = 'f'
            AND (
              pg_get_functiondef(p.oid) LIKE '%card_stock_cards%'
              OR pg_get_functiondef(p.oid) LIKE '%card_stock_balance%'
              OR pg_get_functiondef(p.oid) LIKE '%card_stock_receipt%'
              OR pg_get_functiondef(p.oid) LIKE '%card_stock_transaction_entries%'
              OR pg_get_functiondef(p.oid) LIKE '%card_transfer_request%'
            )
        LOOP
          function_definition := pg_get_functiondef(r.signature);
          -- Protect enum type names: table renames are substrings of these enums.
          function_definition := replace(
            function_definition,
            'card_stock_transaction_entries_operation_type_enum',
            '__ENUM_CSE_OP__'
          );
          function_definition := replace(
            function_definition,
            'card_stock_cards_status_enum',
            '__ENUM_CSC_STATUS__'
          );
          function_definition := replace(
            function_definition,
            'card_stock_receipts_status_enum',
            '__ENUM_CSR_STATUS__'
          );
          function_definition := replace(
            function_definition,
            'card_transfer_requests_status_enum',
            '__ENUM_CTR_STATUS__'
          );
          -- Protect function names that embed a renamed table substring so
          -- CREATE OR REPLACE updates the existing function instead of creating
          -- an orphan (e.g. card_stock_balance_recalculate_sale_profit).
          function_definition := replace(
            function_definition,
            'card_stock_balance_recalculate_sale_profit',
            '__FN_BALANCE_RECALC_SALE_PROFIT__'
          );
          function_definition := replace(
            function_definition,
            'card_stock_transaction_entries',
            'product_stock_transaction_entries'
          );
          function_definition := replace(
            function_definition,
            'card_transfer_request_cards',
            'product_transfer_request_products'
          );
          function_definition := replace(
            function_definition,
            'card_transfer_request_items',
            'product_transfer_request_items'
          );
          function_definition := replace(
            function_definition,
            'card_stock_receipt_items',
            'product_stock_receipt_items'
          );
          function_definition := replace(
            function_definition,
            'card_transfer_requests',
            'product_transfer_requests'
          );
          function_definition := replace(
            function_definition,
            'card_stock_receipts',
            'product_stock_receipts'
          );
          function_definition := replace(
            function_definition,
            'card_stock_cards',
            'product_stock_products'
          );
          function_definition := replace(
            function_definition,
            'card_stock_balance',
            'product_stock_balance'
          );
          function_definition := replace(
            function_definition,
            '__FN_BALANCE_RECALC_SALE_PROFIT__',
            'card_stock_balance_recalculate_sale_profit'
          );
          function_definition := replace(
            function_definition,
            '__ENUM_CSE_OP__',
            'card_stock_transaction_entries_operation_type_enum'
          );
          function_definition := replace(
            function_definition,
            '__ENUM_CSC_STATUS__',
            'card_stock_cards_status_enum'
          );
          function_definition := replace(
            function_definition,
            '__ENUM_CSR_STATUS__',
            'card_stock_receipts_status_enum'
          );
          function_definition := replace(
            function_definition,
            '__ENUM_CTR_STATUS__',
            'card_transfer_requests_status_enum'
          );
          EXECUTE function_definition;
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        r record;
        function_definition text;
      BEGIN
        FOR r IN
          SELECT p.oid::regprocedure AS signature
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public'
            AND p.prokind = 'f'
            AND (
              pg_get_functiondef(p.oid) LIKE '%product_stock_products%'
              OR pg_get_functiondef(p.oid) LIKE '%product_stock_balance%'
              OR pg_get_functiondef(p.oid) LIKE '%product_stock_receipt%'
              OR pg_get_functiondef(p.oid) LIKE '%product_stock_transaction_entries%'
              OR pg_get_functiondef(p.oid) LIKE '%product_transfer_request%'
            )
        LOOP
          function_definition := pg_get_functiondef(r.signature);
          -- Protect enum type names from reverse table renames.
          function_definition := replace(
            function_definition,
            'card_stock_transaction_entries_operation_type_enum',
            '__ENUM_CSE_OP__'
          );
          function_definition := replace(
            function_definition,
            'card_stock_cards_status_enum',
            '__ENUM_CSC_STATUS__'
          );
          function_definition := replace(
            function_definition,
            'card_stock_receipts_status_enum',
            '__ENUM_CSR_STATUS__'
          );
          function_definition := replace(
            function_definition,
            'card_transfer_requests_status_enum',
            '__ENUM_CTR_STATUS__'
          );
          function_definition := replace(
            function_definition,
            'product_stock_balance_recalculate_sale_profit',
            '__FN_BALANCE_RECALC_SALE_PROFIT__'
          );
          function_definition := replace(
            function_definition,
            'card_stock_balance_recalculate_sale_profit',
            '__FN_BALANCE_RECALC_SALE_PROFIT_CARD__'
          );
          function_definition := replace(
            function_definition,
            'product_stock_transaction_entries',
            'card_stock_transaction_entries'
          );
          function_definition := replace(
            function_definition,
            'product_transfer_request_products',
            'card_transfer_request_cards'
          );
          function_definition := replace(
            function_definition,
            'product_transfer_request_items',
            'card_transfer_request_items'
          );
          function_definition := replace(
            function_definition,
            'product_stock_receipt_items',
            'card_stock_receipt_items'
          );
          function_definition := replace(
            function_definition,
            'product_transfer_requests',
            'card_transfer_requests'
          );
          function_definition := replace(
            function_definition,
            'product_stock_receipts',
            'card_stock_receipts'
          );
          function_definition := replace(
            function_definition,
            'product_stock_products',
            'card_stock_cards'
          );
          function_definition := replace(
            function_definition,
            'product_stock_balance',
            'card_stock_balance'
          );
          function_definition := replace(
            function_definition,
            '__FN_BALANCE_RECALC_SALE_PROFIT__',
            'product_stock_balance_recalculate_sale_profit'
          );
          function_definition := replace(
            function_definition,
            '__FN_BALANCE_RECALC_SALE_PROFIT_CARD__',
            'card_stock_balance_recalculate_sale_profit'
          );
          function_definition := replace(
            function_definition,
            '__ENUM_CSE_OP__',
            'card_stock_transaction_entries_operation_type_enum'
          );
          function_definition := replace(
            function_definition,
            '__ENUM_CSC_STATUS__',
            'card_stock_cards_status_enum'
          );
          function_definition := replace(
            function_definition,
            '__ENUM_CSR_STATUS__',
            'card_stock_receipts_status_enum'
          );
          function_definition := replace(
            function_definition,
            '__ENUM_CTR_STATUS__',
            'card_transfer_requests_status_enum'
          );
          EXECUTE function_definition;
        END LOOP;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        r record;
        new_name text;
      BEGIN
        FOR r IN
          SELECT indexname
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND (
              indexname LIKE '%product_stock_%'
              OR indexname LIKE '%product_transfer_%'
            )
            AND indexname NOT LIKE '%product_settlement%'
        LOOP
          new_name := r.indexname;
          new_name := replace(new_name, 'product_stock_transaction_entries', 'card_stock_transaction_entries');
          new_name := replace(new_name, 'product_transfer_request_products', 'card_transfer_request_cards');
          new_name := replace(new_name, 'product_transfer_request_items', 'card_transfer_request_items');
          new_name := replace(new_name, 'product_stock_receipt_items', 'card_stock_receipt_items');
          new_name := replace(new_name, 'product_transfer_requests', 'card_transfer_requests');
          new_name := replace(new_name, 'product_stock_receipts', 'card_stock_receipts');
          new_name := replace(new_name, 'product_stock_products', 'card_stock_cards');
          new_name := replace(new_name, 'product_stock_balance', 'card_stock_balance');
          new_name := replace(new_name, 'product_stock_entries', 'card_stock_entries');
          IF new_name <> r.indexname THEN
            EXECUTE format('ALTER INDEX %I RENAME TO %I', r.indexname, new_name);
          END IF;
        END LOOP;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        r record;
        new_name text;
      BEGIN
        FOR r IN
          SELECT c.conname, t.relname
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = 'public'
            AND (
              c.conname LIKE '%product_stock_%'
              OR c.conname LIKE '%product_transfer_%'
            )
            AND c.conname NOT LIKE '%product_settlement%'
        LOOP
          new_name := r.conname;
          new_name := replace(new_name, 'product_stock_transaction_entries', 'card_stock_transaction_entries');
          new_name := replace(new_name, 'product_transfer_request_products', 'card_transfer_request_cards');
          new_name := replace(new_name, 'product_transfer_request_items', 'card_transfer_request_items');
          new_name := replace(new_name, 'product_stock_receipt_items', 'card_stock_receipt_items');
          new_name := replace(new_name, 'product_transfer_requests', 'card_transfer_requests');
          new_name := replace(new_name, 'product_stock_receipts', 'card_stock_receipts');
          new_name := replace(new_name, 'product_stock_products', 'card_stock_cards');
          new_name := replace(new_name, 'product_stock_balance', 'card_stock_balance');
          new_name := replace(new_name, 'product_stock_entries', 'card_stock_entries');
          IF new_name <> r.conname THEN
            EXECUTE format(
              'ALTER TABLE %I RENAME CONSTRAINT %I TO %I',
              r.relname,
              r.conname,
              new_name
            );
          END IF;
        END LOOP;
      END $$;
    `);

    for (const [from, to] of [...this.tableRenames].reverse()) {
      await queryRunner.query(`ALTER TABLE "${to}" RENAME TO "${from}"`);
    }
  }
}
