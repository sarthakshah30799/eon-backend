import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Data-preserving rename of shared CARD+TT settlement tables to product_* + product_code.
 * Rewrites PL/pgSQL bodies that hardcode card_stock_settlements.
 * Created via TypeORM migration:create (src/migrations2/rename-product-settlements).
 */
export class RenameProductSettlements1790256217716
  implements MigrationInterface
{
  name = "RenameProductSettlements1790256217716";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.card_stock_settlements') IS NULL THEN
          RAISE EXCEPTION 'card_stock_settlements not found — cannot rename';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "card_stock_settlements"
        ADD COLUMN IF NOT EXISTS "product_code" citext
    `);

    // Prefer product_snapshot code (CC / CM / TT / …). Only TT may fall back from type —
    // CARD rows can be CC or CM, so never invent 'CC' when snapshot is missing.
    await queryRunner.query(`
      UPDATE "card_stock_settlements"
      SET "product_code" = UPPER(COALESCE(
        NULLIF(TRIM("product_snapshot"->>'code'), ''),
        NULLIF(TRIM("product_snapshot"->>'productCode'), ''),
        NULLIF(TRIM("product_snapshot"->>'product_code'), ''),
        CASE WHEN "type" = 'TT' THEN 'TT' ELSE NULL END
      ))
      WHERE "product_code" IS NULL OR TRIM("product_code"::text) = ''
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM "card_stock_settlements"
          WHERE "product_code" IS NULL OR TRIM("product_code"::text) = ''
        ) THEN
          RAISE EXCEPTION
            'product_code backfill failed: some settlement rows have no product_snapshot code (CC/CM/TT). Fix snapshots before NOT NULL.';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "card_stock_settlements"
        ALTER COLUMN "product_code" SET NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_card_stock_settlements_product_code"
        ON "card_stock_settlements" ("product_code")
    `);

    await queryRunner.query(
      `ALTER TABLE "card_stock_settlement_documents" RENAME TO "product_settlement_documents"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" RENAME TO "product_settlements"`,
    );

    await queryRunner.query(`
      DO $$
      DECLARE
        r record;
      BEGIN
        FOR r IN
          SELECT c.conname, t.relname
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = 'public'
            AND t.relname IN ('product_settlements', 'product_settlement_documents')
            AND c.conname LIKE 'FK_card_stock_settlement%'
        LOOP
          EXECUTE format(
            'ALTER TABLE %I RENAME CONSTRAINT %I TO %I',
            r.relname,
            r.conname,
            replace(r.conname, 'card_stock_settlement', 'product_settlement')
          );
        END LOOP;

        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'CHK_card_stock_settlements_type_refs'
        ) THEN
          ALTER TABLE "product_settlements"
            RENAME CONSTRAINT "CHK_card_stock_settlements_type_refs"
            TO "CHK_product_settlements_type_refs";
        END IF;
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
            AND tablename IN ('product_settlements', 'product_settlement_documents')
            AND indexname LIKE '%card_stock_settlement%'
        LOOP
          new_name := replace(r.indexname, 'card_stock_settlement', 'product_settlement');
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
            AND pg_get_functiondef(p.oid) LIKE '%card_stock_settlements%'
        LOOP
          function_definition := pg_get_functiondef(r.signature);
          function_definition := replace(
            function_definition,
            'card_stock_settlements',
            'product_settlements'
          );
          function_definition := replace(
            function_definition,
            'card_stock_settlement_documents',
            'product_settlement_documents'
          );
          function_definition := replace(
            function_definition,
            'IF t.slug=''CARD_SETTLE'' THEN',
            'IF t.slug IN (''CARD_SETTLE'',''CM_SETTLE'',''TT_SETTLE'') THEN'
          );
          EXECUTE function_definition;
        END LOOP;
      END $$;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE VIEW public.account_postings_combined AS
      SELECT
        'TRANSACTION'::text AS document_kind,
        posting.id AS posting_id,
        posting.transaction_id AS document_id,
        tx.number AS document_number,
        COALESCE(tx.slug, '')::text AS document_type,
        (tx.transaction_date)::date AS transaction_date,
        tx.branch_id AS branch_id,
        posting.account_id AS account_id,
        posting.account_snapshot AS account_snapshot,
        posting.profile_id AS profile_id,
        NULL::jsonb AS profile_snapshot,
        posting.direction::text AS direction,
        posting.amount AS amount,
        posting.remarks AS remarks,
        posting.line_no AS line_no,
        posting.source_type::text AS source_type,
        posting.source_id AS source_id,
        NULL::uuid AS linked_transaction_id,
        posting.created_at AS created_at,
        tx.party_profile_snapshot AS party_snapshot,
        tx.remarks AS narration,
        payment.reference_number AS cheque_number,
        payment.reference_date AS cheque_date,
        tx.trade_mode::text AS trade_mode
      FROM public.transaction_account_postings posting
      INNER JOIN public.transactions tx
        ON tx.id = posting.transaction_id
      LEFT JOIN public.transaction_payments payment
        ON payment.id = posting.source_id
        AND posting.source_type::text = 'PAYMENT'
        AND payment.deleted_at IS NULL
      WHERE posting.deleted_at IS NULL
        AND tx.deleted_at IS NULL
        AND tx.is_latest = true
        AND tx.status = 'APPROVED'
        AND COALESCE(tx.slug, '') NOT IN (
          'CARD_STOCK',
          'CARD_TRANSFER_OUT',
          'CARD_TRANSFER_IN',
          'CARD_STOCK_LOAD',
          'CARD_SELL',
          'CARD_SETTLE',
          'CM_SETTLE',
          'TT_SETTLE',
          'CARD_RETURN',
          'CARD_VOID'
        )

      UNION ALL

      SELECT
        'VOUCHER'::text AS document_kind,
        posting.id AS posting_id,
        posting.voucher_id AS document_id,
        voucher.number AS document_number,
        voucher.voucher_type::text AS document_type,
        voucher.transaction_date AS transaction_date,
        voucher.branch_id AS branch_id,
        posting.account_id AS account_id,
        posting.account_snapshot AS account_snapshot,
        posting.profile_id AS profile_id,
        posting.profile_snapshot AS profile_snapshot,
        posting.direction::text AS direction,
        posting.amount AS amount,
        posting.remarks AS remarks,
        posting.line_no AS line_no,
        posting.source_type::text AS source_type,
        posting.source_id AS source_id,
        posting.transaction_id AS linked_transaction_id,
        posting.created_at AS created_at,
        voucher.party_profile_snapshot AS party_snapshot,
        voucher.narration AS narration,
        voucher.cheque_number AS cheque_number,
        voucher.cheque_date AS cheque_date,
        NULL::text AS trade_mode
      FROM public.voucher_account_postings posting
      INNER JOIN public.accounting_vouchers voucher
        ON voucher.id = posting.voucher_id
      WHERE posting.deleted_at IS NULL
        AND voucher.deleted_at IS NULL
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
            AND pg_get_functiondef(p.oid) LIKE '%product_settlements%'
        LOOP
          function_definition := pg_get_functiondef(r.signature);
          function_definition := replace(
            function_definition,
            'IF t.slug IN (''CARD_SETTLE'',''CM_SETTLE'',''TT_SETTLE'') THEN',
            'IF t.slug=''CARD_SETTLE'' THEN'
          );
          function_definition := replace(
            function_definition,
            'product_settlement_documents',
            'card_stock_settlement_documents'
          );
          function_definition := replace(
            function_definition,
            'product_settlements',
            'card_stock_settlements'
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
            AND tablename IN ('product_settlements', 'product_settlement_documents')
            AND indexname LIKE '%product_settlement%'
        LOOP
          new_name := replace(r.indexname, 'product_settlement', 'card_stock_settlement');
          IF new_name <> r.indexname THEN
            EXECUTE format('ALTER INDEX %I RENAME TO %I', r.indexname, new_name);
          END IF;
        END LOOP;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'CHK_product_settlements_type_refs'
        ) THEN
          ALTER TABLE "product_settlements"
            RENAME CONSTRAINT "CHK_product_settlements_type_refs"
            TO "CHK_card_stock_settlements_type_refs";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        r record;
      BEGIN
        FOR r IN
          SELECT c.conname, t.relname
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = 'public'
            AND t.relname IN ('product_settlements', 'product_settlement_documents')
            AND c.conname LIKE 'FK_product_settlement%'
        LOOP
          EXECUTE format(
            'ALTER TABLE %I RENAME CONSTRAINT %I TO %I',
            r.relname,
            r.conname,
            replace(r.conname, 'product_settlement', 'card_stock_settlement')
          );
        END LOOP;
      END $$;
    `);

    await queryRunner.query(
      `ALTER TABLE "product_settlements" RENAME TO "card_stock_settlements"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_settlement_documents" RENAME TO "card_stock_settlement_documents"`,
    );

    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" DROP COLUMN IF EXISTS "product_code"`,
    );
  }
}
