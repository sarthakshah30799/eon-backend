import { MigrationInterface, QueryRunner } from 'typeorm';

export class ManualBooksStatusMigration1783900000000 implements MigrationInterface {
  name = 'ManualBooksStatusMigration1783900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the new enum type
    await queryRunner.query(
      `CREATE TYPE "public"."manual_books_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`
    );

    // Add a temporary column with the new enum type
    await queryRunner.query(
      `ALTER TABLE "manual_books" ADD COLUMN "status_new" "public"."manual_books_status_enum" NOT NULL DEFAULT 'PENDING'`
    );

    // Migrate existing data
    await queryRunner.query(`
      UPDATE "manual_books"
      SET "status_new" = CASE
        WHEN "status" = 'Approved' THEN 'APPROVED'::"public"."manual_books_status_enum"
        WHEN "status" = 'Rejected' THEN 'REJECTED'::"public"."manual_books_status_enum"
        ELSE 'PENDING'::"public"."manual_books_status_enum"
      END
    `);

    // Drop the old varchar column
    await queryRunner.query(`ALTER TABLE "manual_books" DROP COLUMN "status"`);

    // Rename the new column to status
    await queryRunner.query(`ALTER TABLE "manual_books" RENAME COLUMN "status_new" TO "status"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add back varchar column
    await queryRunner.query(
      `ALTER TABLE "manual_books" ADD COLUMN "status_old" character varying(50) NOT NULL DEFAULT 'Pending'`
    );

    // Migrate data back
    await queryRunner.query(`
      UPDATE "manual_books"
      SET "status_old" = CASE
        WHEN "status" = 'APPROVED' THEN 'Approved'
        WHEN "status" = 'REJECTED' THEN 'Rejected'
        ELSE 'Pending'
      END
    `);

    // Drop enum column
    await queryRunner.query(`ALTER TABLE "manual_books" DROP COLUMN "status"`);

    // Rename old column back
    await queryRunner.query(`ALTER TABLE "manual_books" RENAME COLUMN "status_old" TO "status"`);

    // Drop the enum type
    await queryRunner.query(`DROP TYPE "public"."manual_books_status_enum"`);
  }
}
