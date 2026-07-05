import { MigrationInterface, QueryRunner } from "typeorm";

export class RedesignChequeAllocation1783172179189 implements MigrationInterface {
    name = 'RedesignChequeAllocation1783172179189'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cheque_book_page_tracking" DROP CONSTRAINT "FK_6896a4b2b0031bc5817c72e4fd0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cheque_book_page_tracking_alloc"`);
        await queryRunner.query(`ALTER TABLE "cheque_book_page_tracking" RENAME COLUMN "allocation_id" TO "assigned_to_user_id"`);
        await queryRunner.query(`CREATE INDEX "IDX_cheque_book_page_tracking_user" ON "cheque_book_page_tracking" ("assigned_to_user_id") `);
        await queryRunner.query(`DROP TABLE "check_book_allocations"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "check_book_allocations" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "check_book_id" uuid NOT NULL,
                "book_no" integer NOT NULL,
                "cashier_id" uuid NOT NULL,
                "remarks" text,
                "allocated_by" uuid NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_check_book_allocations_book" UNIQUE ("check_book_id", "book_no"),
                CONSTRAINT "PK_check_book_allocations" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`ALTER TABLE "check_book_allocations" ADD CONSTRAINT "FK_check_book_allocations_check_book" FOREIGN KEY ("check_book_id") REFERENCES "cheque_books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cheque_book_page_tracking_user"`);
        await queryRunner.query(`ALTER TABLE "cheque_book_page_tracking" RENAME COLUMN "assigned_to_user_id" TO "allocation_id"`);
        await queryRunner.query(`CREATE INDEX "IDX_cheque_book_page_tracking_alloc" ON "cheque_book_page_tracking" ("allocation_id") `);
        await queryRunner.query(`ALTER TABLE "cheque_book_page_tracking" ADD CONSTRAINT "FK_6896a4b2b0031bc5817c72e4fd0" FOREIGN KEY ("allocation_id") REFERENCES "check_book_allocations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
