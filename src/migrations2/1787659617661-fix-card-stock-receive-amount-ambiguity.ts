import { MigrationInterface, QueryRunner } from "typeorm";

export class FixCardStockReceiveAmountAmbiguity1787659617661 implements MigrationInterface {
  name = "FixCardStockReceiveAmountAmbiguity1787659617661";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE OR REPLACE FUNCTION public.card_stock_on_card_insert() RETURNS trigger LANGUAGE plpgsql AS $fn$
            DECLARE
              r record;
              entry_id uuid;
              v_receive_amount numeric := 0;
            BEGIN
              SELECT receipt.id AS receipt_id, receipt.receipt_date, i.currency_id, i.currency_snapshot, i.product_id, i.product_snapshot, i.issuer_party_profile_id, i.issuer_party_profile_snapshot, receipt.branch_id, receipt.branch_snapshot, receipt.created_by, technical.id AS technical_transaction_id
                INTO r
              FROM card_stock_receipt_items i
              JOIN card_stock_receipts receipt ON receipt.id=i.receipt_id
              LEFT JOIN transactions technical
                ON technical.card_stock_reference_type='CARD_STOCK_RECEIPT'
               AND technical.card_stock_reference_id=receipt.id
               AND technical.status='APPROVED'
               AND technical.slug='CARD_STOCK'
              WHERE i.id=NEW.receipt_item_id;
              IF r.technical_transaction_id IS NULL THEN RETURN NEW; END IF;
              v_receive_amount := coalesce(NEW.amount, NEW.denomination, 0);
              entry_id := card_stock_insert_entry(
                NEW.id,r.technical_transaction_id,'CARD_STOCK_RECEIPT',r.receipt_id,'STOCK',r.branch_id,r.branch_snapshot,r.currency_id,r.currency_snapshot,r.product_id,r.product_snapshot,r.issuer_party_profile_id,r.issuer_party_profile_snapshot,NEW.series,r.receipt_date::timestamptz,0,v_receive_amount,r.created_by
              );
              IF entry_id IS NOT NULL THEN
                INSERT INTO card_stock_balance(
                  card_id,branch_id,branch_snapshot,currency_id,currency_snapshot,product_id,product_snapshot,issuer_party_profile_id,issuer_party_profile_snapshot,series,receive_date,receive_rate,receive_amount,receive_entry_id,created_by,updated_by
                )
                VALUES(
                  NEW.id,r.branch_id,r.branch_snapshot,r.currency_id,r.currency_snapshot,r.product_id,r.product_snapshot,r.issuer_party_profile_id,r.issuer_party_profile_snapshot,NEW.series,r.receipt_date::timestamptz,0,v_receive_amount,entry_id,r.created_by,r.created_by
                )
                ON CONFLICT (card_id,branch_id) WHERE is_active=true DO NOTHING;
                UPDATE card_stock_balance
                   SET receive_rate=0, receive_amount=v_receive_amount, updated_by=r.created_by
                 WHERE receive_entry_id=entry_id;
              END IF;
              RETURN NEW;
            END;
            $fn$
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE OR REPLACE FUNCTION public.card_stock_on_card_insert() RETURNS trigger LANGUAGE plpgsql AS $fn$
            DECLARE
              r record;
              entry_id uuid;
              receive_amount numeric := 0;
            BEGIN
              SELECT receipt.id AS receipt_id, receipt.receipt_date, i.currency_id, i.currency_snapshot, i.product_id, i.product_snapshot, i.issuer_party_profile_id, i.issuer_party_profile_snapshot, receipt.branch_id, receipt.branch_snapshot, receipt.created_by, technical.id AS technical_transaction_id
                INTO r
              FROM card_stock_receipt_items i
              JOIN card_stock_receipts receipt ON receipt.id=i.receipt_id
              LEFT JOIN transactions technical
                ON technical.card_stock_reference_type='CARD_STOCK_RECEIPT'
               AND technical.card_stock_reference_id=receipt.id
               AND technical.status='APPROVED'
               AND technical.slug='CARD_STOCK'
              WHERE i.id=NEW.receipt_item_id;
              IF r.technical_transaction_id IS NULL THEN RETURN NEW; END IF;
              receive_amount := coalesce(NEW.amount, NEW.denomination, 0);
              entry_id := card_stock_insert_entry(
                NEW.id,r.technical_transaction_id,'CARD_STOCK_RECEIPT',r.receipt_id,'STOCK',r.branch_id,r.branch_snapshot,r.currency_id,r.currency_snapshot,r.product_id,r.product_snapshot,r.issuer_party_profile_id,r.issuer_party_profile_snapshot,NEW.series,r.receipt_date::timestamptz,0,receive_amount,r.created_by
              );
              IF entry_id IS NOT NULL THEN
                INSERT INTO card_stock_balance(
                  card_id,branch_id,branch_snapshot,currency_id,currency_snapshot,product_id,product_snapshot,issuer_party_profile_id,issuer_party_profile_snapshot,series,receive_date,receive_rate,receive_amount,receive_entry_id,created_by,updated_by
                )
                VALUES(
                  NEW.id,r.branch_id,r.branch_snapshot,r.currency_id,r.currency_snapshot,r.product_id,r.product_snapshot,r.issuer_party_profile_id,r.issuer_party_profile_snapshot,NEW.series,r.receipt_date::timestamptz,0,receive_amount,entry_id,r.created_by,r.created_by
                )
                ON CONFLICT (card_id,branch_id) WHERE is_active=true DO NOTHING;
                UPDATE card_stock_balance
                   SET receive_rate=0, receive_amount=receive_amount, updated_by=r.created_by
                 WHERE receive_entry_id=entry_id;
              END IF;
              RETURN NEW;
            END;
            $fn$
        `);
  }
}
