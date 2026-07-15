import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTransactionPaymentBreakdownColumns1784041141707
  implements MigrationInterface
{
  name = "AddTransactionPaymentBreakdownColumns1784041141707";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD "by_cash" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD "by_cheque" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD "by_card" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD "by_transfer" numeric(18,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD "by_other" numeric(18,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "by_other"`);
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN "by_transfer"`,
    );
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "by_card"`);
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN "by_cheque"`,
    );
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "by_cash"`);
  }
}
