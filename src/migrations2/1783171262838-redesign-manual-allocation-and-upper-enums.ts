import { MigrationInterface, QueryRunner } from "typeorm";

export class RedesignManualAllocationAndUpperEnums1783171262838 implements MigrationInterface {
    name = 'RedesignManualAllocationAndUpperEnums1783171262838'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "manual_book_page_tracking" DROP CONSTRAINT "FK_8e6af8a322c0feadd600355ecdf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_manual_book_page_tracking_alloc"`);
        await queryRunner.query(`ALTER TABLE "manual_book_page_tracking" RENAME COLUMN "allocation_id" TO "assigned_to_user_id"`);

        // Refactor manual_book_page_tracking status column:
        await queryRunner.query(`ALTER TABLE "manual_book_page_tracking" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "manual_book_page_tracking" ALTER COLUMN "status" TYPE text`);
        await queryRunner.query(`UPDATE "manual_book_page_tracking" SET "status" = UPPER("status")`);
        await queryRunner.query(`UPDATE "manual_book_page_tracking" SET "status" = 'VOID' WHERE "status" = 'LOST'`);
        await queryRunner.query(`DROP TYPE "public"."manual_book_page_tracking_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."manual_book_page_tracking_status_enum" AS ENUM('ALLOCATED', 'USED', 'VOID')`);
        await queryRunner.query(`ALTER TABLE "manual_book_page_tracking" ALTER COLUMN "status" TYPE "public"."manual_book_page_tracking_status_enum" USING "status"::"public"."manual_book_page_tracking_status_enum"`);
        await queryRunner.query(`ALTER TABLE "manual_book_page_tracking" ALTER COLUMN "status" SET DEFAULT 'ALLOCATED'`);

        // Refactor cheque_book_page_tracking status column:
        await queryRunner.query(`ALTER TABLE "cheque_book_page_tracking" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "cheque_book_page_tracking" ALTER COLUMN "status" TYPE text`);
        await queryRunner.query(`UPDATE "cheque_book_page_tracking" SET "status" = UPPER("status")`);
        await queryRunner.query(`UPDATE "cheque_book_page_tracking" SET "status" = 'VOID' WHERE "status" = 'LOST'`);
        await queryRunner.query(`DROP TYPE "public"."cheque_book_page_tracking_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."cheque_book_page_tracking_status_enum" AS ENUM('ALLOCATED', 'USED', 'VOID')`);
        await queryRunner.query(`ALTER TABLE "cheque_book_page_tracking" ALTER COLUMN "status" TYPE "public"."cheque_book_page_tracking_status_enum" USING "status"::"public"."cheque_book_page_tracking_status_enum"`);
        await queryRunner.query(`ALTER TABLE "cheque_book_page_tracking" ALTER COLUMN "status" SET DEFAULT 'ALLOCATED'`);

        await queryRunner.query(`CREATE INDEX "IDX_manual_book_page_tracking_user" ON "manual_book_page_tracking" ("assigned_to_user_id") `);
        await queryRunner.query(`DROP TABLE "manual_book_allocations"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "manual_book_allocations" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "manual_book_id" uuid NOT NULL,
                "book_no" integer NOT NULL,
                "cashier_id" uuid NOT NULL,
                "remarks" text,
                "allocated_by" uuid NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_manual_book_allocations_book" UNIQUE ("manual_book_id", "book_no"),
                CONSTRAINT "PK_manual_book_allocations" PRIMARY KEY ("id"),
                CONSTRAINT "FK_manual_book_allocations_manual_book" FOREIGN KEY ("manual_book_id") REFERENCES "manual_books" ("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_manual_book_allocations_query" ON "manual_book_allocations" ("manual_book_id", "book_no")
        `);
        await queryRunner.query(`DROP INDEX "public"."IDX_manual_book_page_tracking_user"`);
        await queryRunner.query(`CREATE TYPE "public"."cheque_book_page_tracking_status_enum_old" AS ENUM('Allocated', 'Used', 'Void', 'Lost')`);
        await queryRunner.query(`ALTER TABLE "cheque_book_page_tracking" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "cheque_book_page_tracking" ALTER COLUMN "status" TYPE "public"."cheque_book_page_tracking_status_enum_old" USING "status"::"text"::"public"."cheque_book_page_tracking_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "cheque_book_page_tracking" ALTER COLUMN "status" SET DEFAULT 'Allocated'`);
        await queryRunner.query(`DROP TYPE "public"."cheque_book_page_tracking_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."cheque_book_page_tracking_status_enum_old" RENAME TO "cheque_book_page_tracking_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."manual_book_page_tracking_status_enum_old" AS ENUM('Allocated', 'Used', 'Void', 'Lost')`);
        await queryRunner.query(`ALTER TABLE "manual_book_page_tracking" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "manual_book_page_tracking" ALTER COLUMN "status" TYPE "public"."manual_book_page_tracking_status_enum_old" USING "status"::"text"::"public"."manual_book_page_tracking_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "manual_book_page_tracking" ALTER COLUMN "status" SET DEFAULT 'Allocated'`);
        await queryRunner.query(`DROP TYPE "public"."manual_book_page_tracking_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."manual_book_page_tracking_status_enum_old" RENAME TO "manual_book_page_tracking_status_enum"`);
        await queryRunner.query(`ALTER TABLE "manual_book_page_tracking" RENAME COLUMN "assigned_to_user_id" TO "allocation_id"`);
        await queryRunner.query(`CREATE INDEX "IDX_manual_book_page_tracking_alloc" ON "manual_book_page_tracking" ("allocation_id") `);
        await queryRunner.query(`ALTER TABLE "manual_book_page_tracking" ADD CONSTRAINT "FK_8e6af8a322c0feadd600355ecdf" FOREIGN KEY ("allocation_id") REFERENCES "manual_book_allocations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
