import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCheckbookTables1782754691758 implements MigrationInterface {
    name = 'CreateCheckbookTables1782754691758'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "manual_book_allocations" DROP CONSTRAINT "FK_manual_book_allocations_manual_book"`);
        await queryRunner.query(`CREATE TABLE "check_books" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dispatch_date" date NOT NULL, "no" character varying(50) NOT NULL, "branch_id" uuid NOT NULL, "transaction_type" character varying(100) NOT NULL, "book_no_from" integer NOT NULL, "book_no_to" integer NOT NULL, "vouchers_per_book" integer NOT NULL, "mv_no_from" integer NOT NULL, "mv_no_to" integer NOT NULL, "assigned_to" character varying(100) NOT NULL, "remarks" text, "status" character varying(50) NOT NULL DEFAULT 'Pending', "from_date" date, "to_date" date, "approval_remarks" text, "approved_at" TIMESTAMP, "approved_by" uuid, "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_60e51020c05bfa7aa1c9cf7a142" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "check_book_allocations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "check_book_id" uuid NOT NULL, "book_no" integer NOT NULL, "cashier_id" uuid NOT NULL, "remarks" text, "allocated_by" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_check_book_allocations_book" UNIQUE ("check_book_id", "book_no"), CONSTRAINT "PK_ef8beae82be7e52a6da10410ade" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_check_book_allocations_query" ON "check_book_allocations" ("check_book_id", "book_no") `);
        await queryRunner.query(`ALTER TABLE "manual_book_allocations" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "manual_book_allocations" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "manual_book_allocations" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "manual_book_allocations" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "manual_book_allocations" ADD CONSTRAINT "FK_9c3f1467c1e160a433d97a215bc" FOREIGN KEY ("manual_book_id") REFERENCES "manual_books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "check_book_allocations" ADD CONSTRAINT "FK_30c8c17b98d081989a9338701a8" FOREIGN KEY ("check_book_id") REFERENCES "check_books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "check_book_allocations" DROP CONSTRAINT "FK_30c8c17b98d081989a9338701a8"`);
        await queryRunner.query(`ALTER TABLE "manual_book_allocations" DROP CONSTRAINT "FK_9c3f1467c1e160a433d97a215bc"`);
        await queryRunner.query(`ALTER TABLE "manual_book_allocations" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "manual_book_allocations" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "manual_book_allocations" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "manual_book_allocations" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`DROP INDEX "public"."IDX_check_book_allocations_query"`);
        await queryRunner.query(`DROP TABLE "check_book_allocations"`);
        await queryRunner.query(`DROP TABLE "check_books"`);
        await queryRunner.query(`ALTER TABLE "manual_book_allocations" ADD CONSTRAINT "FK_manual_book_allocations_manual_book" FOREIGN KEY ("manual_book_id") REFERENCES "manual_books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
