import { MigrationInterface, QueryRunner } from "typeorm";

export class AllowCmTtSettlePartyCheck1790268100672
  implements MigrationInterface
{
  name = "AllowCmTtSettlePartyCheck1790268100672";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CHK_transactions_party_profile_required_v2"`,
    );
    await queryRunner.query(`
      ALTER TABLE "transactions" ADD CONSTRAINT "CHK_transactions_party_profile_required_v2"
      CHECK (
        UPPER("slug") IN (
          'FAKE_CURRENCY',
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
        OR "party_profile_id" IS NOT NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CHK_transactions_party_profile_required_v2"`,
    );
    await queryRunner.query(`
      ALTER TABLE "transactions" ADD CONSTRAINT "CHK_transactions_party_profile_required_v2"
      CHECK (
        UPPER("slug") IN (
          'FAKE_CURRENCY',
          'CARD_STOCK',
          'CARD_TRANSFER_OUT',
          'CARD_TRANSFER_IN',
          'CARD_STOCK_LOAD',
          'CARD_SELL',
          'CARD_SETTLE',
          'CARD_RETURN',
          'CARD_VOID'
        )
        OR "party_profile_id" IS NOT NULL
      )
    `);
  }
}
