import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Read-only combined ledger source for future report/admin cutover.
 * Writers remain on transaction_account_postings and voucher_account_postings.
 */
export class AddAccountPostingsCombinedView1789180044771
  implements MigrationInterface
{
  name = "AddAccountPostingsCombinedView1789180044771";

  public async up(queryRunner: QueryRunner): Promise<void> {
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
    await queryRunner.query(
      `DROP VIEW IF EXISTS public.account_postings_combined`,
    );
  }
}
