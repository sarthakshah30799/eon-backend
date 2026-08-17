import { MigrationInterface, QueryRunner } from "typeorm";

export class CardStockSettlementDocuments1786882847389 implements MigrationInterface {
    name = 'CardStockSettlementDocuments1786882847389'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "card_stock_settlement_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "transaction_number" citext NOT NULL, "transaction_date" TIMESTAMP WITH TIME ZONE NOT NULL, "kind" citext NOT NULL, "status" citext NOT NULL, "issuer_party_profile_id" uuid NOT NULL, "issuer_party_profile_snapshot" jsonb NOT NULL, "currency_id" uuid NOT NULL, "currency_snapshot" jsonb NOT NULL, "branch_id" uuid NOT NULL, "branch_snapshot" jsonb NOT NULL, "ho_branch_id" uuid NOT NULL, "ho_branch_snapshot" jsonb NOT NULL, "reference" citext, "remarks" text, "rejection_reason" text, "cancellation_reason" text, "accepted_at" TIMESTAMP WITH TIME ZONE, "accepted_by_id" uuid, "rejected_at" TIMESTAMP WITH TIME ZONE, "rejected_by_id" uuid, "cancelled_at" TIMESTAMP WITH TIME ZONE, "cancelled_by_id" uuid, "posting_transaction_id" uuid, CONSTRAINT "PK_e7e5ec21d979402eea07a9aea1e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_card_stock_settlement_documents_branch" ON "card_stock_settlement_documents" ("branch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_card_stock_settlement_documents_issuer" ON "card_stock_settlement_documents" ("issuer_party_profile_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_card_stock_settlement_documents_date" ON "card_stock_settlement_documents" ("transaction_date") `);
        await queryRunner.query(`CREATE INDEX "IDX_card_stock_settlement_documents_kind" ON "card_stock_settlement_documents" ("kind") `);
        await queryRunner.query(`CREATE INDEX "IDX_card_stock_settlement_documents_status" ON "card_stock_settlement_documents" ("status") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_card_stock_settlement_documents_number" ON "card_stock_settlement_documents" ("transaction_number") `);
        await queryRunner.query(`ALTER TABLE "card_stock_settlements" ADD "sale_buy_rate" numeric(18,7)`);
        await queryRunner.query(`ALTER TABLE "card_stock_settlements" ADD "issuer_rate" numeric(18,7)`);
        await queryRunner.query(`ALTER TABLE "card_stock_settlements" ADD "issuer_settlement_amount" numeric(18,2)`);
        await queryRunner.query(`ALTER TABLE "card_stock_settlements" ADD "branch_document_id" uuid`);
        await queryRunner.query(`ALTER TABLE "card_stock_settlements" ADD "issuer_document_id" uuid`);
        await queryRunner.query(`UPDATE "card_stock_settlements" SET "sale_buy_rate" = "buy_rate" WHERE "sale_buy_rate" IS NULL`);
        await queryRunner.query(`ALTER TABLE "card_stock_settlements" ALTER COLUMN "sale_buy_rate" SET NOT NULL`);
        await queryRunner.query(`UPDATE "card_stock_settlements" SET "issuer_rate" = "buy_rate", "issuer_settlement_amount" = "settlement_amount" WHERE "status" = 'ISSUER_SETTLED' AND "issuer_settlement_entry_id" IS NOT NULL AND "issuer_rate" IS NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_card_stock_settlements_issuer_document" ON "card_stock_settlements" ("issuer_document_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_card_stock_settlements_branch_document" ON "card_stock_settlements" ("branch_document_id") `);
        await queryRunner.query(`ALTER TABLE "card_stock_settlement_documents" ADD CONSTRAINT "FK_card_stock_settlement_documents_posting" FOREIGN KEY ("posting_transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "card_stock_settlements" ADD CONSTRAINT "FK_card_stock_settlements_branch_document" FOREIGN KEY ("branch_document_id") REFERENCES "card_stock_settlement_documents"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "card_stock_settlements" ADD CONSTRAINT "FK_card_stock_settlements_issuer_document" FOREIGN KEY ("issuer_document_id") REFERENCES "card_stock_settlement_documents"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        await queryRunner.query(`
            CREATE TEMP TABLE tmp_card_settlement_branch_posted ON COMMIT DROP AS
            WITH grouped AS (
              SELECT
                e.transaction_id,
                s.issuer_party_profile_id,
                s.currency_id,
                s.branch_id,
                gen_random_uuid() AS document_id
              FROM card_stock_settlements s
              INNER JOIN card_stock_transaction_entries e ON e.id = s.branch_settlement_entry_id
              WHERE s.deleted_at IS NULL
                AND s.branch_document_id IS NULL
                AND s.branch_settlement_entry_id IS NOT NULL
              GROUP BY e.transaction_id, s.issuer_party_profile_id, s.currency_id, s.branch_id
            ), numbered AS (
              SELECT
                grouped.*,
                COUNT(*) OVER (PARTITION BY grouped.transaction_id) AS group_count,
                ROW_NUMBER() OVER (PARTITION BY grouped.transaction_id ORDER BY grouped.issuer_party_profile_id, grouped.currency_id, grouped.branch_id) AS group_no
              FROM grouped
            )
            SELECT
              numbered.document_id,
              numbered.transaction_id,
              numbered.issuer_party_profile_id,
              numbered.currency_id,
              numbered.branch_id,
              CASE
                WHEN numbered.group_count = 1 AND t.number IS NOT NULL THEN t.number
                WHEN t.number IS NOT NULL THEN t.number || '-BH-' || numbered.group_no::text
                ELSE 'CSB-' || replace(numbered.document_id::text, '-', '')
              END AS transaction_number
            FROM numbered
            INNER JOIN transactions t ON t.id = numbered.transaction_id
        `);
        await queryRunner.query(`
            INSERT INTO card_stock_settlement_documents (
              id, created_at, updated_at, created_by, updated_by,
              transaction_number, transaction_date, kind, status,
              issuer_party_profile_id, issuer_party_profile_snapshot,
              currency_id, currency_snapshot, branch_id, branch_snapshot,
              ho_branch_id, ho_branch_snapshot, reference, remarks,
              accepted_at, accepted_by_id, posting_transaction_id
            )
            SELECT
              g.document_id,
              COALESCE(s.branch_requested_at, s.created_at, NOW()),
              NOW(),
              s.created_by,
              s.updated_by,
              g.transaction_number,
              COALESCE(s.branch_settlement_date, t.transaction_date, s.sale_date),
              'BRANCH_HO',
              'ACCEPTED',
              s.issuer_party_profile_id,
              s.issuer_party_profile_snapshot,
              s.currency_id,
              s.currency_snapshot,
              s.branch_id,
              s.branch_snapshot,
              s.ho_branch_id,
              s.ho_branch_snapshot,
              s.branch_reference,
              s.branch_remarks,
              COALESCE(s.ho_accepted_at, s.branch_settlement_date, t.transaction_date),
              s.ho_accepted_by_id,
              g.transaction_id
            FROM tmp_card_settlement_branch_posted g
            INNER JOIN transactions t ON t.id = g.transaction_id
            INNER JOIN LATERAL (
              SELECT sample.*
              FROM card_stock_settlements sample
              INNER JOIN card_stock_transaction_entries entry ON entry.id = sample.branch_settlement_entry_id
              WHERE sample.deleted_at IS NULL
                AND entry.transaction_id = g.transaction_id
                AND sample.issuer_party_profile_id = g.issuer_party_profile_id
                AND sample.currency_id = g.currency_id
                AND sample.branch_id = g.branch_id
              ORDER BY sample.created_at ASC
              LIMIT 1
            ) s ON TRUE
        `);
        await queryRunner.query(`
            UPDATE card_stock_settlements s
            SET branch_document_id = g.document_id, updated_at = NOW()
            FROM tmp_card_settlement_branch_posted g
            INNER JOIN card_stock_transaction_entries e ON e.transaction_id = g.transaction_id
            WHERE e.id = s.branch_settlement_entry_id
              AND s.deleted_at IS NULL
              AND s.branch_document_id IS NULL
              AND s.issuer_party_profile_id = g.issuer_party_profile_id
              AND s.currency_id = g.currency_id
              AND s.branch_id = g.branch_id
        `);

        await queryRunner.query(`
            CREATE TEMP TABLE tmp_card_settlement_issuer_posted ON COMMIT DROP AS
            WITH grouped AS (
              SELECT
                e.transaction_id,
                s.issuer_party_profile_id,
                s.currency_id,
                s.ho_branch_id,
                gen_random_uuid() AS document_id
              FROM card_stock_settlements s
              INNER JOIN card_stock_transaction_entries e ON e.id = s.issuer_settlement_entry_id
              WHERE s.deleted_at IS NULL
                AND s.issuer_document_id IS NULL
                AND s.issuer_settlement_entry_id IS NOT NULL
              GROUP BY e.transaction_id, s.issuer_party_profile_id, s.currency_id, s.ho_branch_id
            ), numbered AS (
              SELECT
                grouped.*,
                COUNT(*) OVER (PARTITION BY grouped.transaction_id) AS group_count,
                ROW_NUMBER() OVER (PARTITION BY grouped.transaction_id ORDER BY grouped.issuer_party_profile_id, grouped.currency_id, grouped.ho_branch_id) AS group_no
              FROM grouped
            )
            SELECT
              numbered.document_id,
              numbered.transaction_id,
              numbered.issuer_party_profile_id,
              numbered.currency_id,
              numbered.ho_branch_id,
              CASE
                WHEN numbered.group_count = 1 AND t.number IS NOT NULL THEN t.number
                WHEN t.number IS NOT NULL THEN t.number || '-IS-' || numbered.group_no::text
                ELSE 'CSI-' || replace(numbered.document_id::text, '-', '')
              END AS transaction_number
            FROM numbered
            INNER JOIN transactions t ON t.id = numbered.transaction_id
        `);
        await queryRunner.query(`
            INSERT INTO card_stock_settlement_documents (
              id, created_at, updated_at, created_by, updated_by,
              transaction_number, transaction_date, kind, status,
              issuer_party_profile_id, issuer_party_profile_snapshot,
              currency_id, currency_snapshot, branch_id, branch_snapshot,
              ho_branch_id, ho_branch_snapshot, reference, remarks,
              posting_transaction_id
            )
            SELECT
              g.document_id,
              COALESCE(s.issuer_settlement_date, s.updated_at, s.created_at, NOW()),
              NOW(),
              s.created_by,
              s.updated_by,
              g.transaction_number,
              COALESCE(s.issuer_settlement_date, t.transaction_date, s.sale_date),
              'HO_ISSUER',
              'ISSUER_SETTLED',
              s.issuer_party_profile_id,
              s.issuer_party_profile_snapshot,
              s.currency_id,
              s.currency_snapshot,
              s.ho_branch_id,
              s.ho_branch_snapshot,
              s.ho_branch_id,
              s.ho_branch_snapshot,
              s.issuer_reference,
              s.issuer_remarks,
              g.transaction_id
            FROM tmp_card_settlement_issuer_posted g
            INNER JOIN transactions t ON t.id = g.transaction_id
            INNER JOIN LATERAL (
              SELECT sample.*
              FROM card_stock_settlements sample
              INNER JOIN card_stock_transaction_entries entry ON entry.id = sample.issuer_settlement_entry_id
              WHERE sample.deleted_at IS NULL
                AND entry.transaction_id = g.transaction_id
                AND sample.issuer_party_profile_id = g.issuer_party_profile_id
                AND sample.currency_id = g.currency_id
                AND sample.ho_branch_id = g.ho_branch_id
              ORDER BY sample.created_at ASC
              LIMIT 1
            ) s ON TRUE
        `);
        await queryRunner.query(`
            UPDATE card_stock_settlements s
            SET issuer_document_id = g.document_id, updated_at = NOW()
            FROM tmp_card_settlement_issuer_posted g
            INNER JOIN card_stock_transaction_entries e ON e.transaction_id = g.transaction_id
            WHERE e.id = s.issuer_settlement_entry_id
              AND s.deleted_at IS NULL
              AND s.issuer_document_id IS NULL
              AND s.issuer_party_profile_id = g.issuer_party_profile_id
              AND s.currency_id = g.currency_id
              AND s.ho_branch_id = g.ho_branch_id
        `);

        await queryRunner.query(`
            CREATE TEMP TABLE tmp_card_settlement_branch_pending ON COMMIT DROP AS
            SELECT
              gen_random_uuid() AS document_id,
              s.transaction_id,
              s.issuer_party_profile_id,
              s.currency_id,
              s.branch_id,
              NULL::date AS requested_on,
              s.settlement_mode
            FROM card_stock_settlements s
            WHERE s.deleted_at IS NULL
              AND s.branch_document_id IS NULL
              AND s.branch_settlement_entry_id IS NULL
              AND s.status = 'PENDING_HO_ACCEPTANCE'
              AND s.settlement_mode = 'AUTO'
            GROUP BY s.transaction_id, s.issuer_party_profile_id, s.currency_id, s.branch_id, s.settlement_mode
            UNION ALL
            SELECT
              gen_random_uuid() AS document_id,
              NULL::uuid AS transaction_id,
              s.issuer_party_profile_id,
              s.currency_id,
              s.branch_id,
              COALESCE(s.branch_requested_date, s.sale_date)::date AS requested_on,
              s.settlement_mode
            FROM card_stock_settlements s
            WHERE s.deleted_at IS NULL
              AND s.branch_document_id IS NULL
              AND s.branch_settlement_entry_id IS NULL
              AND s.status = 'PENDING_HO_ACCEPTANCE'
              AND s.settlement_mode = 'MANUAL'
            GROUP BY s.issuer_party_profile_id, s.currency_id, s.branch_id, COALESCE(s.branch_requested_date, s.sale_date)::date, s.settlement_mode
        `);
        await queryRunner.query(`
            INSERT INTO card_stock_settlement_documents (
              id, created_at, updated_at, created_by, updated_by,
              transaction_number, transaction_date, kind, status,
              issuer_party_profile_id, issuer_party_profile_snapshot,
              currency_id, currency_snapshot, branch_id, branch_snapshot,
              ho_branch_id, ho_branch_snapshot, reference, remarks
            )
            SELECT
              g.document_id,
              COALESCE(s.branch_requested_at, s.created_at, NOW()),
              NOW(),
              s.created_by,
              s.updated_by,
              'CSB-' || replace(g.document_id::text, '-', ''),
              COALESCE(s.branch_requested_date, s.sale_date),
              'BRANCH_HO',
              'PENDING_HO_ACCEPTANCE',
              s.issuer_party_profile_id,
              s.issuer_party_profile_snapshot,
              s.currency_id,
              s.currency_snapshot,
              s.branch_id,
              s.branch_snapshot,
              s.ho_branch_id,
              s.ho_branch_snapshot,
              s.branch_reference,
              s.branch_remarks
            FROM tmp_card_settlement_branch_pending g
            INNER JOIN LATERAL (
              SELECT sample.*
              FROM card_stock_settlements sample
              WHERE sample.deleted_at IS NULL
                AND sample.branch_document_id IS NULL
                AND sample.branch_settlement_entry_id IS NULL
                AND sample.status = 'PENDING_HO_ACCEPTANCE'
                AND sample.settlement_mode = g.settlement_mode
                AND sample.issuer_party_profile_id = g.issuer_party_profile_id
                AND sample.currency_id = g.currency_id
                AND sample.branch_id = g.branch_id
                AND (
                  (g.settlement_mode = 'AUTO' AND sample.transaction_id = g.transaction_id)
                  OR (
                    g.settlement_mode = 'MANUAL'
                    AND COALESCE(sample.branch_requested_date, sample.sale_date)::date = g.requested_on
                  )
                )
              ORDER BY sample.created_at ASC
              LIMIT 1
            ) s ON TRUE
        `);
        await queryRunner.query(`
            UPDATE card_stock_settlements s
            SET branch_document_id = g.document_id, updated_at = NOW()
            FROM tmp_card_settlement_branch_pending g
            WHERE s.deleted_at IS NULL
              AND s.branch_document_id IS NULL
              AND s.branch_settlement_entry_id IS NULL
              AND s.status = 'PENDING_HO_ACCEPTANCE'
              AND s.settlement_mode = g.settlement_mode
              AND s.issuer_party_profile_id = g.issuer_party_profile_id
              AND s.currency_id = g.currency_id
              AND s.branch_id = g.branch_id
              AND (
                (g.settlement_mode = 'AUTO' AND s.transaction_id = g.transaction_id)
                OR (
                  g.settlement_mode = 'MANUAL'
                  AND COALESCE(s.branch_requested_date, s.sale_date)::date = g.requested_on
                )
              )
        `);

        await queryRunner.query(`
            DO $$
            DECLARE
              function_definition text;
            BEGIN
              function_definition := pg_get_functiondef(
                'public.card_stock_on_transaction_item()'::regprocedure
              );

              IF function_definition LIKE '%r.buy_rate,r.settlement_amount%'
                 AND function_definition NOT LIKE '%r.issuer_rate%' THEN
                function_definition := replace(
                  function_definition,
                  'r.buy_rate,r.settlement_amount',
                  'CASE WHEN coalesce(NEW.card_stock_reference_type,t.card_stock_reference_type)=''CARD_ISSUER_SETTLEMENT'' THEN coalesce(r.issuer_rate, r.buy_rate) ELSE r.buy_rate END, CASE WHEN coalesce(NEW.card_stock_reference_type,t.card_stock_reference_type)=''CARD_ISSUER_SETTLEMENT'' THEN coalesce(r.issuer_settlement_amount, r.settlement_amount) ELSE r.settlement_amount END'
                );
                EXECUTE function_definition;
              END IF;
            END;
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            DECLARE
              function_definition text;
            BEGIN
              function_definition := pg_get_functiondef(
                'public.card_stock_on_transaction_item()'::regprocedure
              );

              IF function_definition LIKE '%r.issuer_rate%' THEN
                function_definition := replace(
                  function_definition,
                  'CASE WHEN coalesce(NEW.card_stock_reference_type,t.card_stock_reference_type)=''CARD_ISSUER_SETTLEMENT'' THEN coalesce(r.issuer_rate, r.buy_rate) ELSE r.buy_rate END, CASE WHEN coalesce(NEW.card_stock_reference_type,t.card_stock_reference_type)=''CARD_ISSUER_SETTLEMENT'' THEN coalesce(r.issuer_settlement_amount, r.settlement_amount) ELSE r.settlement_amount END',
                  'r.buy_rate,r.settlement_amount'
                );
                EXECUTE function_definition;
              END IF;
            END;
            $$;
        `);
        await queryRunner.query(`ALTER TABLE "card_stock_settlements" DROP CONSTRAINT "FK_card_stock_settlements_issuer_document"`);
        await queryRunner.query(`ALTER TABLE "card_stock_settlements" DROP CONSTRAINT "FK_card_stock_settlements_branch_document"`);
        await queryRunner.query(`ALTER TABLE "card_stock_settlement_documents" DROP CONSTRAINT "FK_card_stock_settlement_documents_posting"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_stock_settlements_branch_document"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_stock_settlements_issuer_document"`);
        await queryRunner.query(`ALTER TABLE "card_stock_settlements" DROP COLUMN "issuer_document_id"`);
        await queryRunner.query(`ALTER TABLE "card_stock_settlements" DROP COLUMN "branch_document_id"`);
        await queryRunner.query(`ALTER TABLE "card_stock_settlements" DROP COLUMN "issuer_settlement_amount"`);
        await queryRunner.query(`ALTER TABLE "card_stock_settlements" DROP COLUMN "issuer_rate"`);
        await queryRunner.query(`ALTER TABLE "card_stock_settlements" DROP COLUMN "sale_buy_rate"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_stock_settlement_documents_number"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_stock_settlement_documents_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_stock_settlement_documents_kind"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_stock_settlement_documents_date"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_stock_settlement_documents_issuer"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_stock_settlement_documents_branch"`);
        await queryRunner.query(`DROP TABLE "card_stock_settlement_documents"`);
    }

}
