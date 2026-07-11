import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChequebookStatusEnumAndAssignedBy1784000000000 implements MigrationInterface {
  name = 'ChequebookStatusEnumAndAssignedBy1784000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."cheque_books_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`);
    await queryRunner.query(`ALTER TABLE "cheque_books" ADD COLUMN "status_new" "public"."cheque_books_status_enum" NOT NULL DEFAULT 'PENDING'`);
    await queryRunner.query(`
      UPDATE "cheque_books"
      SET "status_new" = CASE
        WHEN "status" = 'Approved' THEN 'APPROVED'::"public"."cheque_books_status_enum"
        WHEN "status" = 'Rejected' THEN 'REJECTED'::"public"."cheque_books_status_enum"
        ELSE 'PENDING'::"public"."cheque_books_status_enum"
      END
    `);
    await queryRunner.query(`ALTER TABLE "cheque_books" DROP COLUMN "status"`);
    await queryRunner.query(`ALTER TABLE "cheque_books" RENAME COLUMN "status_new" TO "status"`);
    await queryRunner.query(`ALTER TABLE "cheque_books" ALTER COLUMN "assigned_to" TYPE uuid USING "assigned_to"::uuid`);
    await queryRunner.query(`ALTER TABLE "cheque_book_page_tracking" ADD COLUMN "assigned_by" uuid NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cheque_book_page_tracking" DROP COLUMN IF EXISTS "assigned_by"`);
    await queryRunner.query(`ALTER TABLE "cheque_books" ALTER COLUMN "assigned_to" TYPE varchar(100)`);
    await queryRunner.query(`ALTER TABLE "cheque_books" ADD COLUMN "status_old" character varying(50) NOT NULL DEFAULT 'Pending'`);
    await queryRunner.query(`UPDATE "cheque_books" SET "status_old" = CASE WHEN "status" = 'APPROVED' THEN 'Approved' WHEN "status" = 'REJECTED' THEN 'Rejected' ELSE 'Pending' END`);
    await queryRunner.query(`ALTER TABLE "cheque_books" DROP COLUMN "status"`);
    await queryRunner.query(`ALTER TABLE "cheque_books" RENAME COLUMN "status_old" TO "status"`);
    await queryRunner.query(`DROP TYPE "public"."cheque_books_status_enum"`);
  }
}
