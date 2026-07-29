import { MigrationInterface, QueryRunner } from "typeorm";

export class BackfillTransactionBalanceCurrencies1785254964923 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      DO $$
      DECLARE
        tx RECORD;
        opening_qty numeric(18,7);
        opening_rs numeric(18,2);
        purchase_qty numeric(18,7);
        purchase_rs numeric(18,2);
        sell_qty numeric(18,7);
        sell_rs numeric(18,2);
        raw_closing_rs numeric(18,2);
        closing_qty numeric(18,7);
        closing_rs numeric(18,2);
        adjust_sell_rs numeric(18,2);
        profile_type text;
      BEGIN
        DELETE FROM transaction_balance_currencies;

        FOR tx IN
          SELECT
            t.id AS transaction_id,
            t.created_at AS transaction_created_at,
            t.branch_id,
            t.branch_snapshot,
            t.counter_id,
            t.counter_snapshot,
            t.party_profile_snapshot,
            t.transaction_party_profile_type,
            COALESCE(t.updated_by, t.created_by) AS actor_id,
            t.transaction_type,
            ti.currency_id,
            COALESCE(
              ti.currency_snapshot,
              jsonb_build_object('id', ti.currency_id, 'currencyId', ti.currency_id)
            ) AS currency_snapshot,
            SUM(CASE WHEN t.transaction_type = 'PURCHASE' THEN ti.quantity ELSE 0 END)::numeric(18,7) AS purchase_qty,
            SUM(
              CASE
                WHEN t.transaction_type = 'PURCHASE' THEN ti.quantity * (ti.rate / COALESCE(NULLIF(ti.per, 0), 1))
                ELSE 0
              END
            )::numeric(18,2) AS purchase_rs,
            SUM(CASE WHEN t.transaction_type = 'SALE' THEN ti.quantity ELSE 0 END)::numeric(18,7) AS sell_qty,
            SUM(
              CASE
                WHEN t.transaction_type = 'SALE' THEN
                  ti.quantity * COALESCE(NULLIF(ti.hold_cost, 0), ti.rate / COALESCE(NULLIF(ti.per, 0), 1))
                ELSE 0
              END
            )::numeric(18,2) AS sell_rs
          FROM transactions t
          INNER JOIN transaction_items ti ON ti.transaction_id = t.id
          WHERE t.status = 'APPROVED'
            AND t.is_latest = true
            AND t.transaction_type IN ('PURCHASE', 'SALE')
          GROUP BY
            t.id,
            t.created_at,
            t.branch_id,
            t.branch_snapshot,
            t.counter_id,
            t.counter_snapshot,
            t.party_profile_snapshot,
            t.transaction_party_profile_type,
            t.updated_by,
            t.created_by,
            t.transaction_type,
            ti.currency_id,
            ti.currency_snapshot
          ORDER BY t.created_at ASC, t.id ASC, ti.currency_id ASC
        LOOP
          profile_type := CASE
            WHEN UPPER(
              COALESCE(
                tx.transaction_party_profile_type::text,
                tx.party_profile_snapshot->>'type',
                'CORPORATE'
              )
            ) IN ('FFMC', 'FFMC_CLIENT') THEN 'FFMC'
            WHEN UPPER(
              COALESCE(
                tx.transaction_party_profile_type::text,
                tx.party_profile_snapshot->>'type',
                'CORPORATE'
              )
            ) IN ('RMC') THEN 'RMC'
            WHEN UPPER(
              COALESCE(
                tx.transaction_party_profile_type::text,
                tx.party_profile_snapshot->>'type',
                'CORPORATE'
              )
            ) IN ('FOREX', 'FOREX_CORRESPONDENT', 'FOREIGN_CORRESPONDENT') THEN 'FOREX'
            ELSE 'CORPORATE'
          END;

          SELECT
            COALESCE(balance.closing, 0),
            COALESCE(balance.closingrs, 0)
          INTO opening_qty, opening_rs
          FROM transaction_balance_currencies balance
          WHERE balance.branch_id = tx.branch_id
            AND balance.counter_id = tx.counter_id
            AND balance.currency_id = tx.currency_id
            AND balance.profiletype = profile_type
            AND balance.date < tx.transaction_created_at
          ORDER BY balance.date DESC, balance.updated_at DESC
          LIMIT 1;

          opening_qty := COALESCE(opening_qty, 0);
          opening_rs := COALESCE(opening_rs, 0);
          purchase_qty := COALESCE(tx.purchase_qty, 0);
          purchase_rs := COALESCE(tx.purchase_rs, 0);
          sell_qty := COALESCE(tx.sell_qty, 0);
          sell_rs := COALESCE(tx.sell_rs, 0);

          raw_closing_rs := opening_rs + purchase_rs - sell_rs;
          closing_qty := ROUND(opening_qty + purchase_qty - sell_qty, 7);
          closing_rs := ROUND(raw_closing_rs, 2);
          adjust_sell_rs := ROUND(raw_closing_rs - closing_rs, 2);

          INSERT INTO transaction_balance_currencies (
            date,
            branch_id,
            branchsnapshot,
            counter_id,
            countersnapshot,
            currency_id,
            currencysnapshot,
            profiletype,
            opening,
            openingrs,
            purchase,
            purchasers,
            sell,
            sellrs,
            adjustsellrs,
            closing,
            closingrs,
            created_by,
            updated_by
          )
          VALUES (
            tx.transaction_created_at,
            tx.branch_id,
            tx.branch_snapshot,
            tx.counter_id,
            tx.counter_snapshot,
            tx.currency_id,
            tx.currency_snapshot,
            profile_type,
            opening_qty,
            opening_rs,
            purchase_qty,
            purchase_rs,
            sell_qty,
            sell_rs,
            adjust_sell_rs,
            closing_qty,
            closing_rs,
            tx.actor_id,
            tx.actor_id
          );
        END LOOP;
      END;
      $$;
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      DELETE FROM transaction_balance_currencies;
    `);
    }

}
