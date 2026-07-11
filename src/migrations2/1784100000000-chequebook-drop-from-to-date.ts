import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChequebookDropFromToDate1784100000000 implements MigrationInterface {
  name = 'ChequebookDropFromToDate1784100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cheque_books" DROP COLUMN IF EXISTS "from_date"`);
    await queryRunner.query(`ALTER TABLE "cheque_books" DROP COLUMN IF EXISTS "to_date"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cheque_books" ADD COLUMN IF NOT EXISTS "from_date" date`);
    await queryRunner.query(`ALTER TABLE "cheque_books" ADD COLUMN IF NOT EXISTS "to_date" date`);
  }
}
