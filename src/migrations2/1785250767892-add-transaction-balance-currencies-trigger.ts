import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTransactionBalanceCurrenciesTrigger1785250767892 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE OR REPLACE FUNCTION public.enqueue_transaction_balance_currencies_rebuild()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            DECLARE
              affected_transaction_id uuid;
              actor_id uuid;
              operation_name text := TG_OP;
              transaction_created_at timestamptz;
              branch_id uuid;
              counter_id uuid;
              profile_type text;
              currency_ids uuid[] := ARRAY[]::uuid[];
            BEGIN
              IF TG_TABLE_NAME = 'transactions' THEN
                IF TG_OP = 'DELETE' THEN
                  affected_transaction_id := OLD.id;
                  actor_id := COALESCE(OLD.updated_by, OLD.created_by);
                  branch_id := OLD.branch_id;
                  counter_id := OLD.counter_id;
                  transaction_created_at := OLD.created_at;
                  profile_type := COALESCE(OLD.transaction_party_profile_type::text, 'CORPORATE');
                ELSE
                  affected_transaction_id := NEW.id;
                  actor_id := COALESCE(NEW.updated_by, NEW.created_by);
                  branch_id := NEW.branch_id;
                  counter_id := NEW.counter_id;
                  transaction_created_at := NEW.created_at;
                  profile_type := COALESCE(NEW.transaction_party_profile_type::text, 'CORPORATE');
                END IF;

                SELECT COALESCE(array_agg(DISTINCT ti.currency_id), ARRAY[]::uuid[])
                INTO currency_ids
                FROM transaction_items ti
                WHERE ti.transaction_id = affected_transaction_id;
              ELSE
                IF TG_OP = 'DELETE' THEN
                  affected_transaction_id := OLD.transaction_id;
                  actor_id := COALESCE(OLD.updated_by, OLD.created_by);
                ELSE
                  affected_transaction_id := NEW.transaction_id;
                  actor_id := COALESCE(NEW.updated_by, NEW.created_by);
                END IF;

                SELECT
                  t.branch_id,
                  t.counter_id,
                  t.created_at,
                  COALESCE(t.transaction_party_profile_type::text, 'CORPORATE')
                INTO branch_id, counter_id, transaction_created_at, profile_type
                FROM transactions t
                WHERE t.id = affected_transaction_id;

                IF NOT FOUND THEN
                  IF TG_OP = 'DELETE' THEN
                    RETURN OLD;
                  END IF;

                  RETURN NEW;
                END IF;

                SELECT COALESCE(array_agg(DISTINCT ti.currency_id), ARRAY[]::uuid[])
                INTO currency_ids
                FROM transaction_items ti
                WHERE ti.transaction_id = affected_transaction_id;

                IF TG_OP = 'DELETE' THEN
                  currency_ids := (
                    SELECT COALESCE(array_agg(DISTINCT currency_id), ARRAY[]::uuid[])
                    FROM (
                      SELECT unnest(currency_ids) AS currency_id
                      UNION
                      SELECT OLD.currency_id
                    ) currency_union
                  );
                ELSIF TG_OP = 'UPDATE' THEN
                  currency_ids := (
                    SELECT COALESCE(array_agg(DISTINCT currency_id), ARRAY[]::uuid[])
                    FROM (
                      SELECT unnest(currency_ids) AS currency_id
                      UNION
                      SELECT NEW.currency_id
                      UNION
                      SELECT OLD.currency_id
                    ) currency_union
                  );
                END IF;
              END IF;

              DELETE FROM transaction_events
              WHERE transaction_id = affected_transaction_id
                AND event_type = 'BALANCE_CURRENCIES_REBUILD'
                AND status IN ('PENDING', 'PROCESSING');

              INSERT INTO transaction_events (
                id,
                created_at,
                updated_at,
                created_by,
                updated_by,
                transaction_id,
                event_type,
                payload,
                status,
                attempt_count,
                available_at,
                processed_at,
                error_message,
                locked_at,
                locked_by_id
              )
              VALUES (
                uuid_generate_v4(),
                now(),
                now(),
                actor_id,
                actor_id,
                affected_transaction_id,
                'BALANCE_CURRENCIES_REBUILD',
                jsonb_build_object(
                  'transactionId', affected_transaction_id,
                  'branchId', branch_id,
                  'counterId', counter_id,
                  'transactionCreatedAt', transaction_created_at,
                  'profileType', profile_type,
                  'currencyIds', currency_ids,
                  'tableName', TG_TABLE_NAME,
                  'operation', operation_name
                ),
                'PENDING',
                0,
                now(),
                NULL,
                NULL,
                NULL,
                NULL
              );

              IF TG_OP = 'DELETE' THEN
                RETURN OLD;
              END IF;

              RETURN NEW;
            END;
            $$;
        `);
    await queryRunner.query(`
            DROP TRIGGER IF EXISTS transaction_balance_currencies_rebuild_on_transactions ON "transactions";
            CREATE TRIGGER transaction_balance_currencies_rebuild_on_transactions
            AFTER INSERT OR UPDATE ON "transactions"
            FOR EACH ROW
            EXECUTE FUNCTION public.enqueue_transaction_balance_currencies_rebuild();
        `);
    await queryRunner.query(`
            DROP TRIGGER IF EXISTS transaction_balance_currencies_rebuild_on_transactions_delete ON "transactions";
            CREATE TRIGGER transaction_balance_currencies_rebuild_on_transactions_delete
            BEFORE DELETE ON "transactions"
            FOR EACH ROW
            EXECUTE FUNCTION public.enqueue_transaction_balance_currencies_rebuild();
        `);
    await queryRunner.query(`
            DROP TRIGGER IF EXISTS transaction_balance_currencies_rebuild_on_transaction_items ON "transaction_items";
            CREATE TRIGGER transaction_balance_currencies_rebuild_on_transaction_items
            AFTER INSERT OR UPDATE OR DELETE ON "transaction_items"
            FOR EACH ROW
            EXECUTE FUNCTION public.enqueue_transaction_balance_currencies_rebuild();
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP TRIGGER IF EXISTS transaction_balance_currencies_rebuild_on_transaction_items ON "transaction_items";
        `);
    await queryRunner.query(`
            DROP TRIGGER IF EXISTS transaction_balance_currencies_rebuild_on_transactions_delete ON "transactions";
        `);
    await queryRunner.query(`
            DROP TRIGGER IF EXISTS transaction_balance_currencies_rebuild_on_transactions ON "transactions";
        `);
    await queryRunner.query(`
            DROP FUNCTION IF EXISTS public.enqueue_transaction_balance_currencies_rebuild();
        `);
  }
}
