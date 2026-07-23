import { MigrationInterface, QueryRunner } from "typeorm";

export class MergePurchaseNumberingSeries1784811588284 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          DO $$
          DECLARE
            v_category_id uuid;
            v_corporate_id uuid;
            v_individual_id uuid;
            v_corporate_series integer;
            v_individual_series integer;
            v_next_series integer;
          BEGIN
            SELECT id
            INTO v_category_id
            FROM advanced_settings
            WHERE UPPER(code) = 'TRANSACTION_NUMBERING'
              AND node_type = 'category'
            ORDER BY created_at ASC
            LIMIT 1;

            IF v_category_id IS NULL THEN
              RETURN;
            END IF;

            SELECT
              id,
              CASE
                WHEN value_number IS NOT NULL THEN value_number
                WHEN value_text IS NOT NULL AND value_text ~ '^[0-9]+$' THEN value_text::integer
                ELSE NULL
              END
            INTO
              v_corporate_id,
              v_corporate_series
            FROM advanced_settings
            WHERE parent_id = v_category_id
              AND UPPER(code) = 'PURCHASE_CORPORATE'
              AND node_type = 'setting'
            ORDER BY created_at ASC
            LIMIT 1;

            SELECT
              id,
              CASE
                WHEN value_number IS NOT NULL THEN value_number
                WHEN value_text IS NOT NULL AND value_text ~ '^[0-9]+$' THEN value_text::integer
                ELSE NULL
              END
            INTO
              v_individual_id,
              v_individual_series
            FROM advanced_settings
            WHERE parent_id = v_category_id
              AND UPPER(code) = 'PURCHASE_INDIVIDUAL'
              AND node_type = 'setting'
            ORDER BY created_at ASC
            LIMIT 1;

            IF v_corporate_id IS NOT NULL AND v_individual_id IS NOT NULL THEN
              v_next_series := GREATEST(COALESCE(v_corporate_series, 0), COALESCE(v_individual_series, 0));

              UPDATE advanced_settings
              SET
                label = 'PURCHASE CORPORATE / INDIVIDUAL',
                description = 'PURCHASE CORPORATE / INDIVIDUAL',
                value_number = v_next_series,
                value_text = NULL,
                value_date = NULL,
                value_json = NULL,
                value_boolean = NULL,
                updated_at = now()
              WHERE id = v_corporate_id;

              DELETE FROM advanced_settings
              WHERE id = v_individual_id;
            ELSIF v_corporate_id IS NULL AND v_individual_id IS NOT NULL THEN
              UPDATE advanced_settings
              SET
                code = 'PURCHASE_CORPORATE',
                label = 'PURCHASE CORPORATE / INDIVIDUAL',
                description = 'PURCHASE CORPORATE / INDIVIDUAL',
                value_number = COALESCE(v_individual_series, 0),
                value_text = NULL,
                value_date = NULL,
                value_json = NULL,
                value_boolean = NULL,
                updated_at = now()
              WHERE id = v_individual_id;
            ELSIF v_corporate_id IS NOT NULL THEN
              UPDATE advanced_settings
              SET
                label = 'PURCHASE CORPORATE / INDIVIDUAL',
                description = 'PURCHASE CORPORATE / INDIVIDUAL',
                updated_at = now()
              WHERE id = v_corporate_id;
            END IF;
          END
          $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          DO $$
          DECLARE
            v_category_id uuid;
            v_corporate_row record;
            v_individual_exists boolean;
          BEGIN
            SELECT id
            INTO v_category_id
            FROM advanced_settings
            WHERE UPPER(code) = 'TRANSACTION_NUMBERING'
              AND node_type = 'category'
            ORDER BY created_at ASC
            LIMIT 1;

            IF v_category_id IS NULL THEN
              RETURN;
            END IF;

            SELECT EXISTS (
              SELECT 1
              FROM advanced_settings
              WHERE parent_id = v_category_id
                AND UPPER(code) = 'PURCHASE_INDIVIDUAL'
                AND node_type = 'setting'
            )
            INTO v_individual_exists;

            IF v_individual_exists THEN
              RETURN;
            END IF;

            SELECT *
            INTO v_corporate_row
            FROM advanced_settings
            WHERE parent_id = v_category_id
              AND UPPER(code) = 'PURCHASE_CORPORATE'
              AND node_type = 'setting'
            ORDER BY created_at ASC
            LIMIT 1;

            IF NOT FOUND THEN
              RETURN;
            END IF;

            INSERT INTO advanced_settings (
              id,
              parent_id,
              code,
              label,
              description,
              node_type,
              value_type,
              value_boolean,
              value_text,
              value_number,
              value_decimal,
              value_date,
              value_json,
              sort_order,
              is_active,
              created_at,
              updated_at,
              created_by,
              updated_by
            ) VALUES (
              uuid_generate_v4(),
              v_corporate_row.parent_id,
              'PURCHASE_INDIVIDUAL',
              'PURCHASE INDIVIDUAL',
              'PURCHASE INDIVIDUAL',
              v_corporate_row.node_type,
              v_corporate_row.value_type,
              v_corporate_row.value_boolean,
              v_corporate_row.value_text,
              v_corporate_row.value_number,
              v_corporate_row.value_decimal,
              v_corporate_row.value_date,
              v_corporate_row.value_json,
              v_corporate_row.sort_order + 1,
              v_corporate_row.is_active,
              now(),
              now(),
              v_corporate_row.created_by,
              v_corporate_row.updated_by
            );
          END
          $$;
        `);
    }

}
