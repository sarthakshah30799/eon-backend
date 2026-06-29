import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateManualBookAllocationsTable1782700000000 implements MigrationInterface {
    name = 'CreateManualBookAllocationsTable1782700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "manual_book_allocations" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "manual_book_id" uuid NOT NULL,
                "book_no" integer NOT NULL,
                "cashier_id" uuid NOT NULL,
                "remarks" text,
                "allocated_by" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_manual_book_allocations_book" UNIQUE ("manual_book_id", "book_no"),
                CONSTRAINT "PK_manual_book_allocations" PRIMARY KEY ("id"),
                CONSTRAINT "FK_manual_book_allocations_manual_book" FOREIGN KEY ("manual_book_id") REFERENCES "manual_books" ("id") ON DELETE CASCADE
            )
        `);

        // Index for performance
        await queryRunner.query(`
            CREATE INDEX "IDX_manual_book_allocations_query" ON "manual_book_allocations" ("manual_book_id", "book_no")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_manual_book_allocations_query"`);
        await queryRunner.query(`DROP TABLE "manual_book_allocations"`);
    }
}
