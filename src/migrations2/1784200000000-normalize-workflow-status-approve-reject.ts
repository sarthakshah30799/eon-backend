import { MigrationInterface, QueryRunner } from "typeorm";

export class NormalizeWorkflowStatusApproveReject1784200000000 implements MigrationInterface {
    name = 'NormalizeWorkflowStatusApproveReject1784200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // --- cheque_books ---
        // Drop default first (it references the enum type, blocking DROP TYPE)
        await queryRunner.query(`ALTER TABLE "cheque_books" ALTER COLUMN "status" DROP DEFAULT`);
        // Cast column to text so we can freely rename values
        await queryRunner.query(`ALTER TABLE "cheque_books" ALTER COLUMN "status" TYPE text`);
        await queryRunner.query(`UPDATE "cheque_books" SET "status" = 'APPROVE' WHERE "status" = 'APPROVED'`);
        await queryRunner.query(`UPDATE "cheque_books" SET "status" = 'REJECT'  WHERE "status" = 'REJECTED'`);
        // Recreate enum with canonical values
        await queryRunner.query(`DROP TYPE "cheque_books_status_enum"`);
        await queryRunner.query(`CREATE TYPE "cheque_books_status_enum" AS ENUM ('PENDING', 'APPROVE', 'REJECT')`);
        // Restore column type and default
        await queryRunner.query(`ALTER TABLE "cheque_books" ALTER COLUMN "status" TYPE "cheque_books_status_enum" USING "status"::"cheque_books_status_enum"`);
        await queryRunner.query(`ALTER TABLE "cheque_books" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"cheque_books_status_enum"`);

        // --- manual_books ---
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "status" TYPE text`);
        await queryRunner.query(`UPDATE "manual_books" SET "status" = 'APPROVE' WHERE "status" = 'APPROVED'`);
        await queryRunner.query(`UPDATE "manual_books" SET "status" = 'REJECT'  WHERE "status" = 'REJECTED'`);
        await queryRunner.query(`DROP TYPE "manual_books_status_enum"`);
        await queryRunner.query(`CREATE TYPE "manual_books_status_enum" AS ENUM ('PENDING', 'APPROVE', 'REJECT')`);
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "status" TYPE "manual_books_status_enum" USING "status"::"manual_books_status_enum"`);
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"manual_books_status_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // --- cheque_books ---
        await queryRunner.query(`ALTER TABLE "cheque_books" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "cheque_books" ALTER COLUMN "status" TYPE text`);
        await queryRunner.query(`UPDATE "cheque_books" SET "status" = 'APPROVED' WHERE "status" = 'APPROVE'`);
        await queryRunner.query(`UPDATE "cheque_books" SET "status" = 'REJECTED' WHERE "status" = 'REJECT'`);
        await queryRunner.query(`DROP TYPE "cheque_books_status_enum"`);
        await queryRunner.query(`CREATE TYPE "cheque_books_status_enum" AS ENUM ('PENDING', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`ALTER TABLE "cheque_books" ALTER COLUMN "status" TYPE "cheque_books_status_enum" USING "status"::"cheque_books_status_enum"`);
        await queryRunner.query(`ALTER TABLE "cheque_books" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"cheque_books_status_enum"`);

        // --- manual_books ---
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "status" TYPE text`);
        await queryRunner.query(`UPDATE "manual_books" SET "status" = 'APPROVED' WHERE "status" = 'APPROVE'`);
        await queryRunner.query(`UPDATE "manual_books" SET "status" = 'REJECTED' WHERE "status" = 'REJECT'`);
        await queryRunner.query(`DROP TYPE "manual_books_status_enum"`);
        await queryRunner.query(`CREATE TYPE "manual_books_status_enum" AS ENUM ('PENDING', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "status" TYPE "manual_books_status_enum" USING "status"::"manual_books_status_enum"`);
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"manual_books_status_enum"`);
    }
}
