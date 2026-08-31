import { MigrationInterface, QueryRunner } from "typeorm";

export class CardStockAutoSettlement1786615878419 implements MigrationInterface {
  name = "CardStockAutoSettlement1786615878419";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."card_stock_settlements_status_enum" AS ENUM('PENDING_ISSUER_SETTLEMENT', 'ISSUER_SETTLED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "card_stock_settlements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "card_id" uuid NOT NULL, "transaction_id" uuid NOT NULL, "transaction_item_id" uuid NOT NULL, "branch_id" uuid NOT NULL, "branch_snapshot" jsonb NOT NULL, "ho_branch_id" uuid NOT NULL, "ho_branch_snapshot" jsonb NOT NULL, "issuer_party_profile_id" uuid NOT NULL, "issuer_party_profile_snapshot" jsonb NOT NULL, "currency_id" uuid NOT NULL, "currency_snapshot" jsonb NOT NULL, "product_id" uuid NOT NULL, "product_snapshot" jsonb NOT NULL, "passenger_id" uuid, "passenger_snapshot" jsonb, "series" citext NOT NULL, "denomination" numeric(18,2) NOT NULL, "buy_rate" numeric(18,7) NOT NULL, "buy_rate_snapshot" jsonb NOT NULL, "settlement_amount" numeric(18,2) NOT NULL, "sale_date" date NOT NULL, "branch_settlement_date" TIMESTAMP WITH TIME ZONE, "branch_settlement_entry_id" uuid, "issuer_settlement_date" date, "issuer_reference" citext, "issuer_settlement_entry_id" uuid, "status" "public"."card_stock_settlements_status_enum" NOT NULL, "cancelled_at" TIMESTAMP WITH TIME ZONE, "cancelled_by_id" uuid, "cancellation_reason" text, CONSTRAINT "PK_6e9eb592e46813fc64b8ef1a100" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_card_stock_settlements_card_item" ON "card_stock_settlements" ("card_id", "transaction_item_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_card_stock_settlements_sale_date" ON "card_stock_settlements" ("sale_date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_card_stock_settlements_issuer" ON "card_stock_settlements" ("issuer_party_profile_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_card_stock_settlements_branch" ON "card_stock_settlements" ("branch_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_card_stock_settlements_status" ON "card_stock_settlements" ("status") `,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" ADD "settle_date" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" ADD "settle_rate" numeric(18,7) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" ADD "settle_amount" numeric(18,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" ADD "settle_entry_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" RENAME COLUMN "receive_transaction_id" TO "receive_entry_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" RENAME COLUMN "transfer_transaction_id" TO "transfer_entry_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" RENAME COLUMN "sell_transaction_id" TO "sell_entry_id"`,
    );
    await queryRunner.query(`UPDATE "card_stock_balance" balance SET "receive_entry_id" = (
          SELECT entry."id" FROM "card_stock_transaction_entries" entry
          WHERE entry."transaction_id" = balance."receive_entry_id"
            AND entry."card_id" = balance."card_id"
            AND entry."branch_id" = balance."branch_id"
            AND entry."series" = balance."series"
            AND entry."operation_type" IN ('STOCK', 'TRANSFER_IN', 'CARD_STOCK_LOAD')
          ORDER BY entry."created_at" DESC LIMIT 1
        ) WHERE balance."receive_entry_id" IS NOT NULL`);
    await queryRunner.query(`UPDATE "card_stock_balance" balance SET "transfer_entry_id" = (
          SELECT entry."id" FROM "card_stock_transaction_entries" entry
          WHERE entry."transaction_id" = balance."transfer_entry_id"
            AND entry."card_id" = balance."card_id"
            AND entry."branch_id" = balance."branch_id"
            AND entry."series" = balance."series"
            AND entry."operation_type" = 'TRANSFER_OUT'
          ORDER BY entry."created_at" DESC LIMIT 1
        ) WHERE balance."transfer_entry_id" IS NOT NULL`);
    await queryRunner.query(`UPDATE "card_stock_balance" balance SET "sell_entry_id" = (
          SELECT entry."id" FROM "card_stock_transaction_entries" entry
          WHERE entry."transaction_id" = balance."sell_entry_id"
            AND entry."card_id" = balance."card_id"
            AND entry."branch_id" = balance."branch_id"
            AND entry."series" = balance."series"
            AND entry."operation_type" = 'SELL'
          ORDER BY entry."created_at" DESC LIMIT 1
        ) WHERE balance."sell_entry_id" IS NOT NULL`);
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS public.card_stock_insert_entry(uuid,uuid,public.card_stock_reference_type_enum,uuid,public.card_stock_transaction_entries_operation_type_enum,uuid,jsonb,uuid,jsonb,uuid,jsonb,uuid,jsonb,citext,timestamptz,numeric,numeric,uuid)`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."card_stock_reference_type_enum" RENAME TO "card_stock_reference_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."card_stock_reference_type_enum" AS ENUM('CARD_STOCK_RECEIPT','CARD_TRANSFER_REQUEST','CARD_SALE','CARD_BRANCH_SETTLEMENT','CARD_ISSUER_SETTLEMENT','CARD_SETTLEMENT','CARD_RETURN','CARD_VOID')`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_transaction_entries" ALTER COLUMN "reference_type" TYPE "public"."card_stock_reference_type_enum" USING "reference_type"::text::"public"."card_stock_reference_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "card_stock_reference_type" TYPE "public"."card_stock_reference_type_enum" USING "card_stock_reference_type"::text::"public"."card_stock_reference_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."card_stock_reference_type_enum_old"`,
    );
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
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" ADD CONSTRAINT "FK_card_stock_balance_receive_entry" FOREIGN KEY ("receive_entry_id") REFERENCES "card_stock_transaction_entries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" ADD CONSTRAINT "FK_card_stock_balance_transfer_entry" FOREIGN KEY ("transfer_entry_id") REFERENCES "card_stock_transaction_entries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" ADD CONSTRAINT "FK_card_stock_balance_sell_entry" FOREIGN KEY ("sell_entry_id") REFERENCES "card_stock_transaction_entries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" ADD CONSTRAINT "FK_card_stock_balance_settle_entry" FOREIGN KEY ("settle_entry_id") REFERENCES "card_stock_transaction_entries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" ADD CONSTRAINT "FK_card_stock_settlements_card" FOREIGN KEY ("card_id") REFERENCES "card_stock_cards"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" ADD CONSTRAINT "FK_card_stock_settlements_transaction" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" ADD CONSTRAINT "FK_card_stock_settlements_transaction_item" FOREIGN KEY ("transaction_item_id") REFERENCES "transaction_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" ADD CONSTRAINT "FK_card_stock_settlements_branch_entry" FOREIGN KEY ("branch_settlement_entry_id") REFERENCES "card_stock_transaction_entries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" ADD CONSTRAINT "FK_card_stock_settlements_issuer_entry" FOREIGN KEY ("issuer_settlement_entry_id") REFERENCES "card_stock_transaction_entries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`CREATE OR REPLACE FUNCTION public.card_stock_on_card_insert() RETURNS trigger LANGUAGE plpgsql AS $fn$
          DECLARE r record; entry_id uuid; BEGIN
            SELECT receipt.id AS receipt_id, receipt.receipt_date, i.currency_id, i.currency_snapshot, i.product_id, i.product_snapshot, i.issuer_party_profile_id, i.issuer_party_profile_snapshot, receipt.ho_branch_id, receipt.ho_branch_snapshot, receipt.created_by, technical.id AS technical_transaction_id INTO r
            FROM card_stock_receipt_items i JOIN card_stock_receipts receipt ON receipt.id=i.receipt_id LEFT JOIN transactions technical ON technical.card_stock_reference_type='CARD_STOCK_RECEIPT' AND technical.card_stock_reference_id=receipt.id AND technical.status='APPROVED' AND technical.slug='CARD_STOCK' WHERE i.id=NEW.receipt_item_id;
            IF r.technical_transaction_id IS NULL THEN RETURN NEW; END IF;
            entry_id := card_stock_insert_entry(NEW.id,r.technical_transaction_id,'CARD_STOCK_RECEIPT',r.receipt_id,'STOCK',r.ho_branch_id,r.ho_branch_snapshot,r.currency_id,r.currency_snapshot,r.product_id,r.product_snapshot,r.issuer_party_profile_id,r.issuer_party_profile_snapshot,NEW.series,r.receipt_date::timestamptz,0,0,r.created_by);
            IF entry_id IS NOT NULL THEN
              INSERT INTO card_stock_balance(card_id,branch_id,branch_snapshot,currency_id,currency_snapshot,product_id,product_snapshot,issuer_party_profile_id,issuer_party_profile_snapshot,series,receive_date,receive_rate,receive_amount,receive_entry_id,created_by,updated_by)
              VALUES(NEW.id,r.ho_branch_id,r.ho_branch_snapshot,r.currency_id,r.currency_snapshot,r.product_id,r.product_snapshot,r.issuer_party_profile_id,r.issuer_party_profile_snapshot,NEW.series,r.receipt_date::timestamptz,0,0,entry_id,r.created_by,r.created_by)
              ON CONFLICT (card_id,branch_id) WHERE is_active=true DO NOTHING;
            END IF; RETURN NEW;
          END; $fn$`);
    await queryRunner.query(`CREATE OR REPLACE FUNCTION public.card_stock_on_transaction_item() RETURNS trigger LANGUAGE plpgsql AS $fn$
          DECLARE t record; c record; b record; r record; entry_id uuid; next_series citext; operation public.card_stock_transaction_entries_operation_type_enum; ref_type public.card_stock_reference_type_enum; ref_id uuid; op_rate numeric := 0; op_amount numeric := 0;
          BEGIN
            SELECT * INTO t FROM transactions WHERE id=NEW.transaction_id;
            IF t.id IS NULL OR t.status <> 'APPROVED' OR NEW.card_id IS NULL THEN RETURN NEW; END IF;
            SELECT card.*, i.currency_id AS card_currency_id, i.currency_snapshot AS card_currency_snapshot, i.product_id AS card_product_id, i.product_snapshot AS card_product_snapshot, i.issuer_party_profile_id AS card_issuer_id, i.issuer_party_profile_snapshot AS card_issuer_snapshot INTO c
            FROM card_stock_cards card JOIN card_stock_receipt_items i ON i.id=card.receipt_item_id WHERE card.id=NEW.card_id FOR UPDATE;
            IF c.id IS NULL THEN RAISE EXCEPTION 'CARD % does not exist', NEW.card_id; END IF;

            IF t.slug='CARD_SETTLE' THEN
              SELECT * INTO r FROM card_stock_settlements WHERE id=t.card_stock_reference_id FOR UPDATE;
              IF r.id IS NULL THEN RAISE EXCEPTION 'CARD settlement % does not exist', t.card_stock_reference_id; END IF;
              IF t.card_stock_reference_type NOT IN ('CARD_BRANCH_SETTLEMENT','CARD_ISSUER_SETTLEMENT') THEN RAISE EXCEPTION 'Invalid CARD settlement reference type'; END IF;
              entry_id := card_stock_insert_entry(c.id,t.id,t.card_stock_reference_type,r.id,'SETTLE',t.branch_id,t.branch_snapshot,c.card_currency_id,c.card_currency_snapshot,c.card_product_id,c.card_product_snapshot,c.card_issuer_id,c.card_issuer_snapshot,r.series,t.transaction_date::timestamptz,r.buy_rate,r.settlement_amount,t.created_by);
              IF entry_id IS NOT NULL AND t.card_stock_reference_type='CARD_BRANCH_SETTLEMENT' THEN
                SELECT * INTO b FROM card_stock_balance WHERE card_id=c.id AND branch_id=r.branch_id AND is_active=true ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
                IF b.id IS NULL THEN RAISE EXCEPTION 'No active CARD balance exists for branch settlement'; END IF;
                UPDATE card_stock_balance SET settle_date=t.transaction_date::timestamptz, settle_rate=r.buy_rate, settle_amount=r.settlement_amount, settle_entry_id=entry_id, updated_by=t.created_by WHERE id=b.id;
                UPDATE card_stock_settlements SET branch_settlement_date=t.transaction_date::timestamptz, branch_settlement_entry_id=entry_id, updated_by=t.created_by WHERE id=r.id;
              ELSIF entry_id IS NOT NULL THEN
                UPDATE card_stock_settlements SET issuer_settlement_entry_id=entry_id, updated_by=t.created_by WHERE id=r.id;
              END IF;
              RETURN NEW;
            END IF;

            IF t.slug IN ('CARD_TRANSFER_OUT','CARD_TRANSFER_IN') THEN
              operation := CASE WHEN t.slug='CARD_TRANSFER_OUT' THEN 'TRANSFER_OUT'::public.card_stock_transaction_entries_operation_type_enum ELSE 'TRANSFER_IN'::public.card_stock_transaction_entries_operation_type_enum END;
              ref_type := coalesce(t.card_stock_reference_type,'CARD_TRANSFER_REQUEST'); ref_id := coalesce(t.card_stock_reference_id,t.id);
              SELECT * INTO b FROM card_stock_balance WHERE card_id=c.id AND branch_id=t.branch_id AND is_active=true ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
              IF operation='TRANSFER_OUT' THEN
                IF b.id IS NULL THEN RAISE EXCEPTION 'No active CARD balance exists at source branch'; END IF;
                entry_id := card_stock_insert_entry(c.id,t.id,ref_type,ref_id,operation,t.branch_id,t.branch_snapshot,c.card_currency_id,c.card_currency_snapshot,c.card_product_id,c.card_product_snapshot,c.card_issuer_id,c.card_issuer_snapshot,b.series,t.transaction_date::timestamptz,0,0,t.created_by);
                IF entry_id IS NOT NULL THEN UPDATE card_stock_balance SET is_active=false, transfer_date=t.transaction_date::timestamptz, transfer_entry_id=entry_id, updated_by=t.created_by WHERE id=b.id; END IF;
              ELSE
                next_series := card_stock_next_series(card_stock_prefix(c.series), NULL);
                entry_id := card_stock_insert_entry(c.id,t.id,ref_type,ref_id,operation,t.branch_id,t.branch_snapshot,c.card_currency_id,c.card_currency_snapshot,c.card_product_id,c.card_product_snapshot,c.card_issuer_id,c.card_issuer_snapshot,next_series,t.transaction_date::timestamptz,0,0,t.created_by);
                IF entry_id IS NOT NULL THEN INSERT INTO card_stock_balance(card_id,branch_id,branch_snapshot,currency_id,currency_snapshot,product_id,product_snapshot,issuer_party_profile_id,issuer_party_profile_snapshot,series,receive_date,receive_entry_id,created_by,updated_by) VALUES(c.id,t.branch_id,t.branch_snapshot,c.card_currency_id,c.card_currency_snapshot,c.card_product_id,c.card_product_snapshot,c.card_issuer_id,c.card_issuer_snapshot,next_series,t.transaction_date::timestamptz,entry_id,t.created_by,t.created_by) ON CONFLICT (card_id,branch_id) WHERE is_active=true DO NOTHING; END IF;
              END IF;
              RETURN NEW;
            END IF;

            IF t.slug='CARD_STOCK_LOAD' THEN
              SELECT * INTO b FROM card_stock_balance WHERE card_id=c.id AND branch_id=t.branch_id AND is_active=true ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
              next_series := card_stock_next_series(card_stock_prefix(c.series), CASE WHEN b.id IS NULL THEN NULL ELSE b.series END);
              IF b.id IS NOT NULL THEN UPDATE card_stock_balance SET is_active=false, updated_by=t.created_by WHERE id=b.id; END IF;
              entry_id := card_stock_insert_entry(c.id,t.id,coalesce(t.card_stock_reference_type,'CARD_SALE'),coalesce(t.card_stock_reference_id,t.id),'CARD_STOCK_LOAD',t.branch_id,t.branch_snapshot,c.card_currency_id,c.card_currency_snapshot,c.card_product_id,c.card_product_snapshot,c.card_issuer_id,c.card_issuer_snapshot,next_series,t.transaction_date::timestamptz,0,0,t.created_by);
              IF entry_id IS NOT NULL THEN INSERT INTO card_stock_balance(card_id,branch_id,branch_snapshot,currency_id,currency_snapshot,product_id,product_snapshot,issuer_party_profile_id,issuer_party_profile_snapshot,series,receive_date,receive_entry_id,created_by,updated_by) VALUES(c.id,t.branch_id,t.branch_snapshot,c.card_currency_id,c.card_currency_snapshot,c.card_product_id,c.card_product_snapshot,c.card_issuer_id,c.card_issuer_snapshot,next_series,t.transaction_date::timestamptz,entry_id,t.created_by,t.created_by); END IF;
              RETURN NEW;
            END IF;

            IF t.transaction_type='SALE' AND coalesce(c.card_product_snapshot->>'productCode', c.card_product_snapshot->>'product_code')='CC' THEN
              IF NOT EXISTS (SELECT 1 FROM card_stock_transaction_entries load_entry WHERE load_entry.card_id=c.id AND load_entry.operation_type='CARD_STOCK_LOAD' AND load_entry.reference_id=t.id) THEN RETURN NEW; END IF;
              SELECT * INTO b FROM card_stock_balance WHERE card_id=c.id AND branch_id=t.branch_id AND is_active=true ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
              IF b.id IS NULL THEN RAISE EXCEPTION 'No active CARD balance exists at sale branch'; END IF;
              op_rate := coalesce(NEW.rate,0); op_amount := coalesce(NEW.taxable_amount,0);
              entry_id := card_stock_insert_entry(c.id,t.id,coalesce(t.card_stock_reference_type,'CARD_SALE'),coalesce(t.card_stock_reference_id,t.id),'SELL',t.branch_id,t.branch_snapshot,c.card_currency_id,c.card_currency_snapshot,c.card_product_id,c.card_product_snapshot,c.card_issuer_id,c.card_issuer_snapshot,b.series,t.transaction_date::timestamptz,op_rate,op_amount,t.created_by);
              IF entry_id IS NOT NULL THEN UPDATE card_stock_balance SET sell_date=t.transaction_date::timestamptz, sell_rate=op_rate, sell_amount=op_amount, sell_entry_id=entry_id, updated_by=t.created_by WHERE id=b.id; UPDATE card_stock_cards SET status='SOLD', updated_by=t.created_by WHERE id=c.id; END IF;
            END IF;
            RETURN NEW;
          END; $fn$`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" DROP CONSTRAINT "FK_card_stock_settlements_issuer_entry"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" DROP CONSTRAINT "FK_card_stock_settlements_branch_entry"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" DROP CONSTRAINT "FK_card_stock_settlements_transaction_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" DROP CONSTRAINT "FK_card_stock_settlements_transaction"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" DROP CONSTRAINT "FK_card_stock_settlements_card"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" DROP CONSTRAINT "FK_card_stock_balance_settle_entry"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" DROP CONSTRAINT "FK_card_stock_balance_sell_entry"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" DROP CONSTRAINT "FK_card_stock_balance_transfer_entry"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" DROP CONSTRAINT "FK_card_stock_balance_receive_entry"`,
    );
    await queryRunner.query(
      `UPDATE "card_stock_balance" balance SET "receive_entry_id" = entry."transaction_id" FROM "card_stock_transaction_entries" entry WHERE entry."id" = balance."receive_entry_id"`,
    );
    await queryRunner.query(
      `UPDATE "card_stock_balance" balance SET "transfer_entry_id" = entry."transaction_id" FROM "card_stock_transaction_entries" entry WHERE entry."id" = balance."transfer_entry_id"`,
    );
    await queryRunner.query(
      `UPDATE "card_stock_balance" balance SET "sell_entry_id" = entry."transaction_id" FROM "card_stock_transaction_entries" entry WHERE entry."id" = balance."sell_entry_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" RENAME COLUMN "sell_entry_id" TO "sell_transaction_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" RENAME COLUMN "transfer_entry_id" TO "transfer_transaction_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" RENAME COLUMN "receive_entry_id" TO "receive_transaction_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" DROP COLUMN "settle_entry_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" DROP COLUMN "settle_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" DROP COLUMN "settle_rate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_balance" DROP COLUMN "settle_date"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_card_stock_settlements_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_card_stock_settlements_branch"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_card_stock_settlements_issuer"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_card_stock_settlements_sale_date"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_card_stock_settlements_card_item"`,
    );
    await queryRunner.query(`DROP TABLE "card_stock_settlements"`);
    await queryRunner.query(
      `DROP TYPE "public"."card_stock_settlements_status_enum"`,
    );
  }
}
