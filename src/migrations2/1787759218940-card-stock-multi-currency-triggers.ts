import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Multi-currency CM: LOAD/SELL use sale currency, SELL matches LOAD by currency,
 * product gate accepts CC and CM, insert_entry conflicts on currency_id.
 */
export class CardStockMultiCurrencyTriggers1787759218940 implements MigrationInterface {
  name = "CardStockMultiCurrencyTriggers1787759218940";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE OR REPLACE FUNCTION public.card_stock_insert_entry(
              p_card uuid, p_tx uuid, p_ref_type public.card_stock_reference_type_enum, p_ref_id uuid, p_op public.card_stock_transaction_entries_operation_type_enum,
              p_branch uuid, p_branch_snapshot jsonb, p_currency uuid, p_currency_snapshot jsonb, p_product uuid, p_product_snapshot jsonb,
              p_issuer uuid, p_issuer_snapshot jsonb, p_series citext, p_date timestamptz, p_rate numeric, p_amount numeric, p_created_by uuid
            ) RETURNS uuid LANGUAGE plpgsql AS $fn$
            DECLARE result_id uuid;
            BEGIN
              INSERT INTO card_stock_transaction_entries(
                card_id,transaction_id,reference_type,reference_id,operation_type,branch_id,branch_snapshot,currency_id,currency_snapshot,product_id,product_snapshot,issuer_party_profile_id,issuer_party_profile_snapshot,series,date,rate,amount,created_by,updated_by
              )
              VALUES(
                p_card,p_tx,p_ref_type,p_ref_id,p_op,p_branch,p_branch_snapshot,p_currency,p_currency_snapshot,p_product,p_product_snapshot,p_issuer,p_issuer_snapshot,p_series,p_date,coalesce(p_rate,0),coalesce(p_amount,0),p_created_by,p_created_by
              )
              ON CONFLICT (card_id,reference_type,reference_id,operation_type,currency_id) DO UPDATE
              SET rate = EXCLUDED.rate,
                  amount = EXCLUDED.amount,
                  updated_by = EXCLUDED.updated_by,
                  updated_at = now()
              RETURNING id INTO result_id;
              RETURN result_id;
            END;
            $fn$
        `);

    await queryRunner.query(`
            CREATE OR REPLACE FUNCTION public.card_stock_on_transaction_item() RETURNS trigger LANGUAGE plpgsql AS $fn$
            DECLARE
              t record;
              c record;
              b record;
              r record;
              entry_id uuid;
              next_series citext;
              operation public.card_stock_transaction_entries_operation_type_enum;
              ref_type public.card_stock_reference_type_enum;
              ref_id uuid;
              card_face numeric := 0;
              op_rate numeric := 0;
              op_amount numeric := 0;
              settle_ref_type public.card_stock_reference_type_enum;
              entry_currency_id uuid;
              entry_currency_snapshot jsonb;
              product_code text;
            BEGIN
              SELECT * INTO t FROM transactions WHERE id=NEW.transaction_id;
              IF t.id IS NULL OR t.status <> 'APPROVED' OR NEW.card_id IS NULL THEN RETURN NEW; END IF;
              SELECT card.*, i.currency_id AS card_currency_id, i.currency_snapshot AS card_currency_snapshot, i.product_id AS card_product_id, i.product_snapshot AS card_product_snapshot, i.issuer_party_profile_id AS card_issuer_id, i.issuer_party_profile_snapshot AS card_issuer_snapshot
                INTO c
              FROM card_stock_cards card
              JOIN card_stock_receipt_items i ON i.id=card.receipt_item_id
              WHERE card.id=NEW.card_id
              FOR UPDATE;
              IF c.id IS NULL THEN RAISE EXCEPTION 'CARD % does not exist', NEW.card_id; END IF;
              card_face := coalesce(c.amount, c.denomination, 0);
              product_code := upper(coalesce(c.card_product_snapshot->>'productCode', c.card_product_snapshot->>'product_code', ''));

              IF t.slug='CARD_SETTLE' THEN
                SELECT * INTO r FROM card_stock_settlements WHERE id=t.card_stock_reference_id FOR UPDATE;
                IF r.id IS NULL THEN RAISE EXCEPTION 'CARD settlement % does not exist', t.card_stock_reference_id; END IF;
                settle_ref_type := coalesce(NEW.card_stock_reference_type, t.card_stock_reference_type);
                IF settle_ref_type NOT IN ('CARD_BRANCH_SETTLEMENT','CARD_ISSUER_SETTLEMENT') THEN RAISE EXCEPTION 'Invalid CARD settlement reference type'; END IF;
                IF settle_ref_type='CARD_ISSUER_SETTLEMENT' THEN
                  op_rate := coalesce(r.issuer_rate, r.buy_rate);
                  op_amount := coalesce(r.issuer_settlement_amount, r.settlement_amount);
                ELSE
                  op_rate := r.buy_rate;
                  op_amount := r.settlement_amount;
                END IF;
                entry_id := card_stock_insert_entry(c.id,t.id,settle_ref_type,r.id,'SETTLE',t.branch_id,t.branch_snapshot,coalesce(r.currency_id, c.card_currency_id),coalesce(r.currency_snapshot, c.card_currency_snapshot),c.card_product_id,c.card_product_snapshot,c.card_issuer_id,c.card_issuer_snapshot,r.series,t.transaction_date::timestamptz,op_rate,op_amount,t.created_by);
                IF entry_id IS NOT NULL AND settle_ref_type='CARD_BRANCH_SETTLEMENT' THEN
                  SELECT * INTO b FROM card_stock_balance WHERE card_id=c.id AND branch_id=r.branch_id AND series=r.series ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
                  IF b.id IS NULL THEN RAISE EXCEPTION 'No CARD balance exists for settlement series %', r.series; END IF;
                  UPDATE card_stock_balance SET settle_date=t.transaction_date::timestamptz, settle_rate=r.buy_rate, settle_amount=r.settlement_amount, settle_entry_id=entry_id, updated_by=t.created_by WHERE id=b.id;
                  UPDATE card_stock_settlements SET branch_settlement_date=t.transaction_date::timestamptz, branch_settlement_entry_id=entry_id, updated_by=t.created_by WHERE id=r.id;
                ELSIF entry_id IS NOT NULL THEN
                  UPDATE card_stock_settlements SET issuer_settlement_entry_id=entry_id, updated_by=t.created_by WHERE id=r.id;
                END IF;
                RETURN NEW;
              END IF;

              IF t.slug IN ('CARD_TRANSFER_OUT','CARD_TRANSFER_IN') THEN
                operation := CASE WHEN t.slug='CARD_TRANSFER_OUT' THEN 'TRANSFER_OUT'::public.card_stock_transaction_entries_operation_type_enum ELSE 'TRANSFER_IN'::public.card_stock_transaction_entries_operation_type_enum END;
                ref_type := coalesce(NEW.card_stock_reference_type, t.card_stock_reference_type, 'CARD_TRANSFER_REQUEST');
                ref_id := coalesce(NEW.card_stock_reference_id, t.card_stock_reference_id, t.id);
                SELECT * INTO b FROM card_stock_balance WHERE card_id=c.id AND branch_id=t.branch_id AND is_active=true ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
                IF operation='TRANSFER_OUT' THEN
                  IF b.id IS NULL THEN RAISE EXCEPTION 'No active CARD balance exists at source branch'; END IF;
                  entry_id := card_stock_insert_entry(c.id,t.id,ref_type,ref_id,operation,t.branch_id,t.branch_snapshot,c.card_currency_id,c.card_currency_snapshot,c.card_product_id,c.card_product_snapshot,c.card_issuer_id,c.card_issuer_snapshot,b.series,t.transaction_date::timestamptz,0,card_face,t.created_by);
                  IF entry_id IS NOT NULL THEN
                    UPDATE card_stock_balance
                       SET is_active=false,
                           transfer_date=t.transaction_date::timestamptz,
                           transfer_rate=0,
                           transfer_amount=card_face,
                           transfer_entry_id=entry_id,
                           updated_by=t.created_by
                     WHERE id=b.id;
                  END IF;
                ELSE
                  next_series := card_stock_next_series(card_stock_prefix(c.series), NULL);
                  entry_id := card_stock_insert_entry(c.id,t.id,ref_type,ref_id,operation,t.branch_id,t.branch_snapshot,c.card_currency_id,c.card_currency_snapshot,c.card_product_id,c.card_product_snapshot,c.card_issuer_id,c.card_issuer_snapshot,next_series,t.transaction_date::timestamptz,0,card_face,t.created_by);
                  IF entry_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM card_stock_balance WHERE receive_entry_id=entry_id) THEN
                    INSERT INTO card_stock_balance(card_id,branch_id,branch_snapshot,currency_id,currency_snapshot,product_id,product_snapshot,issuer_party_profile_id,issuer_party_profile_snapshot,series,receive_date,receive_rate,receive_amount,receive_entry_id,created_by,updated_by)
                    VALUES(c.id,t.branch_id,t.branch_snapshot,c.card_currency_id,c.card_currency_snapshot,c.card_product_id,c.card_product_snapshot,c.card_issuer_id,c.card_issuer_snapshot,next_series,t.transaction_date::timestamptz,0,card_face,entry_id,t.created_by,t.created_by)
                    ON CONFLICT (card_id,branch_id) WHERE is_active=true DO NOTHING;
                  ELSIF entry_id IS NOT NULL THEN
                    UPDATE card_stock_balance SET receive_rate=0, receive_amount=card_face, updated_by=t.created_by WHERE receive_entry_id=entry_id;
                  END IF;
                END IF;
                RETURN NEW;
              END IF;

              IF t.slug='CARD_STOCK_LOAD' THEN
                SELECT coalesce(ti.rate, 0),
                       coalesce(
                         ti.amount,
                         ROUND(coalesce(ti.quantity, 0) * coalesce(ti.rate, 0) / coalesce(NULLIF(ti.per, 0), 1), 0)
                       )
                  INTO op_rate, op_amount
                FROM transaction_items ti
                WHERE ti.card_id=c.id
                  AND ti.transaction_id=coalesce(t.card_stock_reference_id, t.id)
                  AND ti.currency_id=NEW.currency_id
                ORDER BY ti.line_no
                LIMIT 1;
                IF op_amount IS NULL THEN
                  op_rate := 0;
                  op_amount := card_face;
                END IF;
                entry_currency_id := coalesce(NEW.currency_id, c.card_currency_id);
                entry_currency_snapshot := coalesce(
                  (
                    SELECT ti.currency_snapshot
                    FROM transaction_items ti
                    WHERE ti.transaction_id=coalesce(t.card_stock_reference_id, t.id)
                      AND ti.card_id=c.id
                      AND ti.currency_id=entry_currency_id
                    ORDER BY ti.line_no
                    LIMIT 1
                  ),
                  NEW.currency_snapshot,
                  c.card_currency_snapshot
                );
                SELECT * INTO b FROM card_stock_balance WHERE card_id=c.id AND branch_id=t.branch_id AND is_active=true ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
                next_series := card_stock_next_series(card_stock_prefix(c.series), CASE WHEN b.id IS NULL THEN NULL ELSE b.series END);
                entry_id := card_stock_insert_entry(
                  c.id,t.id,coalesce(NEW.card_stock_reference_type,t.card_stock_reference_type,'CARD_SALE'),coalesce(NEW.card_stock_reference_id,t.card_stock_reference_id,t.id),'CARD_STOCK_LOAD',t.branch_id,t.branch_snapshot,entry_currency_id,entry_currency_snapshot,c.card_product_id,c.card_product_snapshot,c.card_issuer_id,c.card_issuer_snapshot,next_series,t.transaction_date::timestamptz,op_rate,op_amount,t.created_by
                );
                IF entry_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM card_stock_balance WHERE receive_entry_id=entry_id) THEN
                  IF b.id IS NOT NULL THEN UPDATE card_stock_balance SET is_active=false, updated_by=t.created_by WHERE id=b.id; END IF;
                  INSERT INTO card_stock_balance(card_id,branch_id,branch_snapshot,currency_id,currency_snapshot,product_id,product_snapshot,issuer_party_profile_id,issuer_party_profile_snapshot,series,receive_date,receive_rate,receive_amount,receive_entry_id,created_by,updated_by)
                  VALUES(c.id,t.branch_id,t.branch_snapshot,entry_currency_id,entry_currency_snapshot,c.card_product_id,c.card_product_snapshot,c.card_issuer_id,c.card_issuer_snapshot,next_series,t.transaction_date::timestamptz,op_rate,op_amount,entry_id,t.created_by,t.created_by);
                ELSIF entry_id IS NOT NULL THEN
                  UPDATE card_stock_balance SET receive_rate=op_rate, receive_amount=op_amount, updated_by=t.created_by WHERE receive_entry_id=entry_id;
                END IF;
                RETURN NEW;
              END IF;

              IF t.transaction_type='SALE' AND product_code IN ('CC','CM') THEN
                IF NOT EXISTS (
                  SELECT 1 FROM card_stock_transaction_entries load_entry
                  WHERE load_entry.card_id=c.id
                    AND load_entry.operation_type='CARD_STOCK_LOAD'
                    AND load_entry.reference_id=t.id
                    AND load_entry.currency_id=NEW.currency_id
                ) THEN RETURN NEW; END IF;
                SELECT * INTO b FROM card_stock_balance WHERE card_id=c.id AND branch_id=t.branch_id AND is_active=true ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
                IF b.id IS NULL THEN RAISE EXCEPTION 'No active CARD balance exists at sale branch'; END IF;
                op_rate := coalesce(NEW.rate, 0);
                op_amount := coalesce(
                  NEW.amount,
                  ROUND(coalesce(NEW.quantity, 0) * coalesce(NEW.rate, 0) / coalesce(NULLIF(NEW.per, 0), 1), 0)
                );
                entry_currency_id := coalesce(NEW.currency_id, c.card_currency_id);
                entry_currency_snapshot := coalesce(NEW.currency_snapshot, c.card_currency_snapshot);
                entry_id := card_stock_insert_entry(
                  c.id,t.id,coalesce(NEW.card_stock_reference_type,t.card_stock_reference_type,'CARD_SALE'),coalesce(NEW.card_stock_reference_id,t.card_stock_reference_id,t.id),'SELL',t.branch_id,t.branch_snapshot,entry_currency_id,entry_currency_snapshot,c.card_product_id,c.card_product_snapshot,c.card_issuer_id,c.card_issuer_snapshot,b.series,t.transaction_date::timestamptz,op_rate,op_amount,t.created_by
                );
                IF entry_id IS NOT NULL THEN
                  UPDATE card_stock_balance
                     SET sell_date=t.transaction_date::timestamptz,
                         sell_rate=op_rate,
                         sell_amount=op_amount,
                         sell_entry_id=entry_id,
                         updated_by=t.created_by
                   WHERE id=b.id;
                  UPDATE card_stock_cards SET status='SOLD', updated_by=t.created_by WHERE id=c.id;
                END IF;
              END IF;
              RETURN NEW;
            END;
            $fn$
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Trigger bodies restored by re-running prior lifecycle migrations if needed.
    await queryRunner.query(`
            CREATE OR REPLACE FUNCTION public.card_stock_insert_entry(
              p_card uuid, p_tx uuid, p_ref_type public.card_stock_reference_type_enum, p_ref_id uuid, p_op public.card_stock_transaction_entries_operation_type_enum,
              p_branch uuid, p_branch_snapshot jsonb, p_currency uuid, p_currency_snapshot jsonb, p_product uuid, p_product_snapshot jsonb,
              p_issuer uuid, p_issuer_snapshot jsonb, p_series citext, p_date timestamptz, p_rate numeric, p_amount numeric, p_created_by uuid
            ) RETURNS uuid LANGUAGE plpgsql AS $fn$
            DECLARE result_id uuid;
            BEGIN
              INSERT INTO card_stock_transaction_entries(
                card_id,transaction_id,reference_type,reference_id,operation_type,branch_id,branch_snapshot,currency_id,currency_snapshot,product_id,product_snapshot,issuer_party_profile_id,issuer_party_profile_snapshot,series,date,rate,amount,created_by,updated_by
              )
              VALUES(
                p_card,p_tx,p_ref_type,p_ref_id,p_op,p_branch,p_branch_snapshot,p_currency,p_currency_snapshot,p_product,p_product_snapshot,p_issuer,p_issuer_snapshot,p_series,p_date,coalesce(p_rate,0),coalesce(p_amount,0),p_created_by,p_created_by
              )
              ON CONFLICT (card_id,operation_type,reference_type,reference_id) DO UPDATE
              SET rate = EXCLUDED.rate,
                  amount = EXCLUDED.amount,
                  updated_by = EXCLUDED.updated_by,
                  updated_at = now()
              RETURNING id INTO result_id;
              RETURN result_id;
            END;
            $fn$
        `);
  }
}
