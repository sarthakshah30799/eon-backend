import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CARD lifecycle schema.  This migration is intentionally in migrations2:
 * CARD stock, transfer and transaction rows live in DB2.  DB1 identifiers are
 * stored with snapshots; no cross-database foreign keys are created.
 */
export class CardStockLifecycleLedger1786555310415 implements MigrationInterface {
  name = "CardStockLifecycleLedger1786555310415";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "card_transfer_requests" ADD COLUMN IF NOT EXISTS "source_transaction_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_transfer_requests" ADD COLUMN IF NOT EXISTS "destination_transaction_id" uuid`,
    );

    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "counter_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'card_stock_reference_type_enum') THEN CREATE TYPE "public"."card_stock_reference_type_enum" AS ENUM('CARD_STOCK_RECEIPT','CARD_TRANSFER_REQUEST','CARD_SALE','CARD_SETTLEMENT','CARD_RETURN','CARD_VOID'); END IF; END $$`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "card_stock_reference_type" "public"."card_stock_reference_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "card_stock_reference_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_receipts" ADD COLUMN IF NOT EXISTS "transaction_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_items" ADD COLUMN IF NOT EXISTS "card_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_items" ADD COLUMN IF NOT EXISTS "issuer_party_profile_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_items" ADD COLUMN IF NOT EXISTS "issuer_party_profile_snapshot" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_items" ADD COLUMN IF NOT EXISTS "card_snapshot" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_items" ADD COLUMN IF NOT EXISTS "is_reload" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(
      `ALTER TYPE "public"."card_stock_cards_status_enum" ADD VALUE IF NOT EXISTS 'SOLD'`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'card_stock_transaction_entries_operation_type_enum') THEN CREATE TYPE "public"."card_stock_transaction_entries_operation_type_enum" AS ENUM('STOCK','TRANSFER_OUT','TRANSFER_IN','CARD_STOCK_LOAD','SELL','SETTLE','RETURN','VOID'); END IF; END $$`,
    );

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "card_stock_transaction_entries" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" timestamptz, "deleted_by" uuid,
      "card_id" uuid NOT NULL, "transaction_id" uuid NOT NULL, "reference_type" "public"."card_stock_reference_type_enum" NOT NULL, "reference_id" uuid NOT NULL,
      "operation_type" "public"."card_stock_transaction_entries_operation_type_enum" NOT NULL, "branch_id" uuid NOT NULL, "branch_snapshot" jsonb NOT NULL,
      "currency_id" uuid NOT NULL, "currency_snapshot" jsonb NOT NULL, "product_id" uuid NOT NULL, "product_snapshot" jsonb NOT NULL,
      "issuer_party_profile_id" uuid NOT NULL, "issuer_party_profile_snapshot" jsonb NOT NULL, "series" citext NOT NULL,
      "date" timestamptz NOT NULL, "rate" numeric(18,7) NOT NULL DEFAULT 0, "amount" numeric(18,2) NOT NULL DEFAULT 0, "remarks" text,
      CONSTRAINT "PK_card_stock_transaction_entries" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_card_stock_entries_card_operation_reference" UNIQUE ("card_id","operation_type","reference_type","reference_id")
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_card_stock_entries_card_date" ON "card_stock_transaction_entries" ("card_id","date")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_card_stock_entries_branch_date" ON "card_stock_transaction_entries" ("branch_id","date")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_card_stock_entries_reference" ON "card_stock_transaction_entries" ("reference_type","reference_id")`,
    );

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "card_stock_balance" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" timestamptz, "deleted_by" uuid,
      "card_id" uuid NOT NULL, "branch_id" uuid NOT NULL, "branch_snapshot" jsonb NOT NULL, "currency_id" uuid NOT NULL, "currency_snapshot" jsonb NOT NULL,
      "product_id" uuid NOT NULL, "product_snapshot" jsonb NOT NULL, "issuer_party_profile_id" uuid NOT NULL, "issuer_party_profile_snapshot" jsonb NOT NULL, "series" citext NOT NULL,
      "receive_date" timestamptz, "receive_rate" numeric(18,7) NOT NULL DEFAULT 0, "receive_amount" numeric(18,2) NOT NULL DEFAULT 0, "receive_transaction_id" uuid,
      "transfer_date" timestamptz, "transfer_rate" numeric(18,7) NOT NULL DEFAULT 0, "transfer_amount" numeric(18,2) NOT NULL DEFAULT 0, "transfer_transaction_id" uuid,
      "sell_date" timestamptz, "sell_rate" numeric(18,7) NOT NULL DEFAULT 0, "sell_amount" numeric(18,2) NOT NULL DEFAULT 0, "sell_transaction_id" uuid,
      "is_active" boolean NOT NULL DEFAULT true,
      CONSTRAINT "PK_card_stock_balance" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_card_stock_balance_card_branch_active" ON "card_stock_balance" ("card_id","branch_id","is_active")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_card_stock_balance_branch_series" ON "card_stock_balance" ("branch_id","series")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_card_stock_balance_active_card_branch" ON "card_stock_balance" ("card_id","branch_id") WHERE "is_active" = true`,
    );

    await queryRunner.query(
      `ALTER TABLE "card_stock_transaction_entries" ADD CONSTRAINT "FK_card_stock_entries_card" FOREIGN KEY ("card_id") REFERENCES "card_stock_cards"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_transaction_entries" ADD CONSTRAINT "FK_card_stock_entries_transaction" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" ADD CONSTRAINT "FK_card_stock_balance_card" FOREIGN KEY ("card_id") REFERENCES "card_stock_cards"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_items" ADD CONSTRAINT "FK_transaction_items_card_id" FOREIGN KEY ("card_id") REFERENCES "card_stock_cards"("id") ON DELETE RESTRICT`,
    );

    await queryRunner.query(
      `CREATE OR REPLACE FUNCTION public.card_stock_prefix(value citext) RETURNS citext LANGUAGE sql IMMUTABLE AS $$ SELECT upper(regexp_replace(value::text, '[0-9]{4}$', ''))::citext $$`,
    );
    await queryRunner.query(`CREATE OR REPLACE FUNCTION public.card_stock_next_series(prefix citext, previous citext DEFAULT NULL) RETURNS citext LANGUAGE plpgsql AS $fn$
      DECLARE n integer := 0; digits text; BEGIN
        IF previous IS NOT NULL AND previous ~ '[0-9]{4}$' THEN n := substring(previous::text from '([0-9]{4})$')::integer + 1; END IF;
        IF n > 9999 THEN RAISE EXCEPTION 'CARD series exhausted for prefix %', prefix; END IF;
        RETURN upper(prefix::text) || lpad(n::text, 4, '0');
      END;
    $fn$`);

    await queryRunner.query(`CREATE OR REPLACE FUNCTION public.card_stock_insert_entry(
      p_card uuid, p_tx uuid, p_ref_type public.card_stock_reference_type_enum, p_ref_id uuid, p_op public.card_stock_transaction_entries_operation_type_enum,
      p_branch uuid, p_branch_snapshot jsonb, p_currency uuid, p_currency_snapshot jsonb, p_product uuid, p_product_snapshot jsonb,
      p_issuer uuid, p_issuer_snapshot jsonb, p_series citext, p_date timestamptz, p_rate numeric, p_amount numeric, p_created_by uuid
    ) RETURNS uuid LANGUAGE plpgsql AS $fn$ DECLARE result_id uuid; BEGIN
      INSERT INTO card_stock_transaction_entries(card_id,transaction_id,reference_type,reference_id,operation_type,branch_id,branch_snapshot,currency_id,currency_snapshot,product_id,product_snapshot,issuer_party_profile_id,issuer_party_profile_snapshot,series,date,rate,amount,created_by,updated_by)
      VALUES(p_card,p_tx,p_ref_type,p_ref_id,p_op,p_branch,p_branch_snapshot,p_currency,p_currency_snapshot,p_product,p_product_snapshot,p_issuer,p_issuer_snapshot,p_series,p_date,coalesce(p_rate,0),coalesce(p_amount,0),p_created_by,p_created_by)
      ON CONFLICT (card_id,operation_type,reference_type,reference_id) DO NOTHING RETURNING id INTO result_id;
      RETURN result_id;
    END; $fn$`);

    await queryRunner.query(`CREATE OR REPLACE FUNCTION public.card_stock_on_card_insert() RETURNS trigger LANGUAGE plpgsql AS $fn$
      DECLARE r record; result uuid; BEGIN
        SELECT receipt.id AS receipt_id, receipt.receipt_date, i.currency_id, i.currency_snapshot, i.product_id, i.product_snapshot, i.issuer_party_profile_id, i.issuer_party_profile_snapshot, receipt.ho_branch_id, receipt.ho_branch_snapshot, receipt.created_by, technical.id AS technical_transaction_id INTO r
        FROM card_stock_receipt_items i JOIN card_stock_receipts receipt ON receipt.id=i.receipt_id LEFT JOIN transactions technical ON technical.card_stock_reference_type='CARD_STOCK_RECEIPT' AND technical.card_stock_reference_id=receipt.id AND technical.status='APPROVED' AND technical.slug='CARD_STOCK' WHERE i.id=NEW.receipt_item_id;
        IF r.technical_transaction_id IS NULL THEN RETURN NEW; END IF;
        result := card_stock_insert_entry(NEW.id,r.technical_transaction_id,'CARD_STOCK_RECEIPT',r.receipt_id,'STOCK',r.ho_branch_id,r.ho_branch_snapshot,r.currency_id,r.currency_snapshot,r.product_id,r.product_snapshot,r.issuer_party_profile_id,r.issuer_party_profile_snapshot,NEW.series,(r.receipt_date::timestamptz),0,0,r.created_by);
        IF result IS NOT NULL THEN
          INSERT INTO card_stock_balance(card_id,branch_id,branch_snapshot,currency_id,currency_snapshot,product_id,product_snapshot,issuer_party_profile_id,issuer_party_profile_snapshot,series,receive_date,receive_rate,receive_amount,receive_transaction_id,created_by,updated_by)
          VALUES(NEW.id,r.ho_branch_id,r.ho_branch_snapshot,r.currency_id,r.currency_snapshot,r.product_id,r.product_snapshot,r.issuer_party_profile_id,r.issuer_party_profile_snapshot,NEW.series,r.receipt_date::timestamptz,0,0,r.technical_transaction_id,r.created_by,r.created_by)
          ON CONFLICT (card_id,branch_id) WHERE is_active=true DO NOTHING;
        END IF; RETURN NEW;
      END; $fn$`);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_card_stock_card_insert_ledger" ON "card_stock_cards"`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "TRG_card_stock_card_insert_ledger" AFTER INSERT ON "card_stock_cards" FOR EACH ROW EXECUTE FUNCTION public.card_stock_on_card_insert()`,
    );

    await queryRunner.query(`CREATE OR REPLACE FUNCTION public.card_stock_on_transaction_item() RETURNS trigger LANGUAGE plpgsql AS $fn$
      DECLARE t record; c record; b record; r record; entry_id uuid; next_series citext; operation public.card_stock_transaction_entries_operation_type_enum; ref_type citext; ref_id uuid; op_rate numeric := 0; op_amount numeric := 0;
      BEGIN
        SELECT * INTO t FROM transactions WHERE id=NEW.transaction_id;
        IF t.id IS NULL OR t.status <> 'APPROVED' OR NEW.card_id IS NULL THEN RETURN NEW; END IF;
        SELECT card.*, i.currency_id AS card_currency_id, i.currency_snapshot AS card_currency_snapshot, i.product_id AS card_product_id, i.product_snapshot AS card_product_snapshot, i.issuer_party_profile_id AS card_issuer_id, i.issuer_party_profile_snapshot AS card_issuer_snapshot INTO c
        FROM card_stock_cards card JOIN card_stock_receipt_items i ON i.id=card.receipt_item_id WHERE card.id=NEW.card_id FOR UPDATE;
        IF c.id IS NULL THEN RAISE EXCEPTION 'CARD % does not exist', NEW.card_id; END IF;
        IF t.slug IN ('CARD_TRANSFER_OUT','CARD_TRANSFER_IN') THEN
          operation := CASE WHEN t.slug='CARD_TRANSFER_OUT' THEN 'TRANSFER_OUT'::public.card_stock_transaction_entries_operation_type_enum ELSE 'TRANSFER_IN'::public.card_stock_transaction_entries_operation_type_enum END;
          ref_type := coalesce(t.card_stock_reference_type,'CARD_TRANSFER_REQUEST'); ref_id := coalesce(t.card_stock_reference_id,t.id);
          SELECT * INTO b FROM card_stock_balance WHERE card_id=c.id AND branch_id=t.branch_id AND is_active=true ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
          IF operation='TRANSFER_OUT' THEN
            IF b.id IS NULL THEN RAISE EXCEPTION 'No active CARD balance exists at source branch'; END IF;
            entry_id := card_stock_insert_entry(c.id,t.id,ref_type,ref_id,operation,t.branch_id,t.branch_snapshot,c.card_currency_id,c.card_currency_snapshot,c.card_product_id,c.card_product_snapshot,c.card_issuer_id,c.card_issuer_snapshot,b.series,t.transaction_date::timestamptz,0,0,t.created_by);
            IF entry_id IS NOT NULL THEN UPDATE card_stock_balance SET is_active=false, transfer_date=t.transaction_date::timestamptz, transfer_transaction_id=t.id, updated_by=t.created_by WHERE id=b.id; END IF;
          ELSE
            next_series := card_stock_next_series(card_stock_prefix(c.series), NULL);
            entry_id := card_stock_insert_entry(c.id,t.id,ref_type,ref_id,operation,t.branch_id,t.branch_snapshot,c.card_currency_id,c.card_currency_snapshot,c.card_product_id,c.card_product_snapshot,c.card_issuer_id,c.card_issuer_snapshot,next_series,t.transaction_date::timestamptz,0,0,t.created_by);
            IF entry_id IS NOT NULL THEN INSERT INTO card_stock_balance(card_id,branch_id,branch_snapshot,currency_id,currency_snapshot,product_id,product_snapshot,issuer_party_profile_id,issuer_party_profile_snapshot,series,receive_date,receive_transaction_id,created_by,updated_by) VALUES(c.id,t.branch_id,t.branch_snapshot,c.card_currency_id,c.card_currency_snapshot,c.card_product_id,c.card_product_snapshot,c.card_issuer_id,c.card_issuer_snapshot,next_series,t.transaction_date::timestamptz,t.id,t.created_by,t.created_by) ON CONFLICT (card_id,branch_id) WHERE is_active=true DO UPDATE SET is_active=false, updated_by=EXCLUDED.updated_by; END IF;
          END IF;
          RETURN NEW;
        END IF;
        IF t.slug='CARD_STOCK_LOAD' THEN
          SELECT * INTO b FROM card_stock_balance WHERE card_id=c.id AND branch_id=t.branch_id AND is_active=true ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
          next_series := card_stock_next_series(card_stock_prefix(c.series), CASE WHEN b.id IS NULL THEN NULL ELSE b.series END);
          IF b.id IS NOT NULL THEN UPDATE card_stock_balance SET is_active=false, updated_by=t.created_by WHERE id=b.id; END IF;
          entry_id := card_stock_insert_entry(c.id,t.id,coalesce(t.card_stock_reference_type,'CARD_SALE'),coalesce(t.card_stock_reference_id,t.id),'CARD_STOCK_LOAD',t.branch_id,t.branch_snapshot,c.card_currency_id,c.card_currency_snapshot,c.card_product_id,c.card_product_snapshot,c.card_issuer_id,c.card_issuer_snapshot,next_series,t.transaction_date::timestamptz,0,0,t.created_by);
          IF entry_id IS NOT NULL THEN INSERT INTO card_stock_balance(card_id,branch_id,branch_snapshot,currency_id,currency_snapshot,product_id,product_snapshot,issuer_party_profile_id,issuer_party_profile_snapshot,series,receive_date,receive_transaction_id,created_by,updated_by) VALUES(c.id,t.branch_id,t.branch_snapshot,c.card_currency_id,c.card_currency_snapshot,c.card_product_id,c.card_product_snapshot,c.card_issuer_id,c.card_issuer_snapshot,next_series,t.transaction_date::timestamptz,t.id,t.created_by,t.created_by); END IF;
          RETURN NEW;
        END IF;
        IF t.transaction_type='SALE' AND coalesce(c.card_product_snapshot->>'productCode', c.card_product_snapshot->>'product_code')='CC' THEN
          IF NOT EXISTS (SELECT 1 FROM card_stock_transaction_entries load_entry WHERE load_entry.card_id=c.id AND load_entry.operation_type='CARD_STOCK_LOAD' AND load_entry.reference_id=t.id) THEN RETURN NEW; END IF;
          SELECT * INTO b FROM card_stock_balance WHERE card_id=c.id AND branch_id=t.branch_id AND is_active=true ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
          IF b.id IS NULL THEN RAISE EXCEPTION 'No active CARD balance exists at sale branch'; END IF;
          op_rate := coalesce(NEW.rate,0); op_amount := coalesce(NEW.amount,0);
          entry_id := card_stock_insert_entry(c.id,t.id,coalesce(t.card_stock_reference_type,'CARD_SALE'),coalesce(t.card_stock_reference_id,t.id),'SELL',t.branch_id,t.branch_snapshot,c.card_currency_id,c.card_currency_snapshot,c.card_product_id,c.card_product_snapshot,c.card_issuer_id,c.card_issuer_snapshot,b.series,t.transaction_date::timestamptz,op_rate,op_amount,t.created_by);
          IF entry_id IS NOT NULL THEN UPDATE card_stock_balance SET sell_date=t.transaction_date::timestamptz, sell_rate=op_rate, sell_amount=op_amount, sell_transaction_id=t.id, updated_by=t.created_by WHERE id=b.id; UPDATE card_stock_cards SET status='SOLD', updated_by=t.created_by WHERE id=c.id; END IF;
        END IF;
        RETURN NEW;
      END; $fn$`);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_card_stock_transaction_item_ledger" ON "transaction_items"`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "TRG_card_stock_transaction_item_ledger" AFTER INSERT OR UPDATE ON "transaction_items" FOR EACH ROW EXECUTE FUNCTION public.card_stock_on_transaction_item()`,
    );
    await queryRunner.query(
      `CREATE OR REPLACE FUNCTION public.card_stock_on_transaction_approved() RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN IF NEW.status='APPROVED' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN UPDATE transaction_items SET updated_at=now() WHERE transaction_id=NEW.id AND card_id IS NOT NULL; END IF; RETURN NEW; END; $fn$`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_card_stock_transaction_approved_ledger" ON "transactions"`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "TRG_card_stock_transaction_approved_ledger" AFTER INSERT OR UPDATE OF "status" ON "transactions" FOR EACH ROW EXECUTE FUNCTION public.card_stock_on_transaction_approved()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_card_stock_card_insert_ledger" ON "card_stock_cards"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS public.card_stock_on_card_insert()`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_card_stock_transaction_item_ledger" ON "transaction_items"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS public.card_stock_on_transaction_item()`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_card_stock_transaction_approved_ledger" ON "transactions"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS public.card_stock_on_transaction_approved()`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS public.card_stock_insert_entry(uuid,uuid,public.card_stock_reference_type_enum,uuid,public.card_stock_transaction_entries_operation_type_enum,uuid,jsonb,uuid,jsonb,uuid,jsonb,uuid,jsonb,citext,timestamptz,numeric,numeric,uuid)`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS public.card_stock_next_series(citext,citext)`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS public.card_stock_prefix(citext)`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_items" DROP CONSTRAINT IF EXISTS "FK_transaction_items_card_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" DROP CONSTRAINT IF EXISTS "FK_card_stock_balance_card"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_transaction_entries" DROP CONSTRAINT IF EXISTS "FK_card_stock_entries_transaction"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_transaction_entries" DROP CONSTRAINT IF EXISTS "FK_card_stock_entries_card"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "card_stock_balance"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "card_stock_transaction_entries"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."card_stock_transaction_entries_operation_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_items" DROP COLUMN IF EXISTS "is_reload"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_items" DROP COLUMN IF EXISTS "card_snapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_items" DROP COLUMN IF EXISTS "issuer_party_profile_snapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_items" DROP COLUMN IF EXISTS "issuer_party_profile_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_items" DROP COLUMN IF EXISTS "card_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN IF EXISTS "card_stock_reference_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN IF EXISTS "card_stock_reference_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_receipts" DROP COLUMN IF EXISTS "transaction_id"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."card_stock_reference_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "counter_id" SET NOT NULL`,
    );
  }
}
