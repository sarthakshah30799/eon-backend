import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateManualBookTables1782473431691 implements MigrationInterface {
    name = 'CreateManualBookTables1782473431691'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "manual_books" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dispatch_date" date NOT NULL, "no" character varying(50) NOT NULL, "branch_id" uuid NOT NULL, "transaction_type" character varying(100) NOT NULL, "book_no_from" integer NOT NULL, "book_no_to" integer NOT NULL, "vouchers_per_book" integer NOT NULL, "mv_no_from" integer NOT NULL, "mv_no_to" integer NOT NULL, "assigned_to" character varying(100) NOT NULL, "remarks" text, "status" character varying(50) NOT NULL DEFAULT 'Pending', "from_date" date, "to_date" date, "approval_remarks" text, "approved_at" TIMESTAMP, "approved_by" uuid, "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a2876423e1ded8f670232064591" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "manual_books"`);
    }

}
