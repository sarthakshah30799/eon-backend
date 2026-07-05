import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePageTrackingTables1783100648842 implements MigrationInterface {
    name = 'CreatePageTrackingTables1783100648842'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."manual_book_page_tracking_status_enum" AS ENUM('Allocated', 'Used', 'Void', 'Lost')`);
        await queryRunner.query(`CREATE TABLE "manual_book_page_tracking" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "manual_book_id" uuid NOT NULL, "allocation_id" uuid NOT NULL, "page_no" integer NOT NULL, "status" "public"."manual_book_page_tracking_status_enum" NOT NULL DEFAULT 'Allocated', "remarks" text, "updated_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_manual_book_page_tracking_number" UNIQUE ("page_no"), CONSTRAINT "PK_5da147d5d8ee1282a8826bd4941" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_manual_book_page_tracking_alloc" ON "manual_book_page_tracking" ("allocation_id") `);
        await queryRunner.query(`CREATE TYPE "public"."cheque_book_page_tracking_status_enum" AS ENUM('Allocated', 'Used', 'Void', 'Lost')`);
        await queryRunner.query(`CREATE TABLE "cheque_book_page_tracking" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "check_book_id" uuid NOT NULL, "allocation_id" uuid NOT NULL, "page_no" integer NOT NULL, "status" "public"."cheque_book_page_tracking_status_enum" NOT NULL DEFAULT 'Allocated', "remarks" text, "updated_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_cheque_book_page_tracking_number" UNIQUE ("page_no"), CONSTRAINT "PK_5a6f582d01bd94fcabb9aedd540" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cheque_book_page_tracking_alloc" ON "cheque_book_page_tracking" ("allocation_id") `);
        await queryRunner.query(`ALTER TABLE "manual_book_page_tracking" ADD CONSTRAINT "FK_ed266adc74c542027d608608364" FOREIGN KEY ("manual_book_id") REFERENCES "manual_books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "manual_book_page_tracking" ADD CONSTRAINT "FK_8e6af8a322c0feadd600355ecdf" FOREIGN KEY ("allocation_id") REFERENCES "manual_book_allocations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cheque_book_page_tracking" ADD CONSTRAINT "FK_c8c2d4c5e41d7ba62fc41369e06" FOREIGN KEY ("check_book_id") REFERENCES "cheque_books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cheque_book_page_tracking" ADD CONSTRAINT "FK_6896a4b2b0031bc5817c72e4fd0" FOREIGN KEY ("allocation_id") REFERENCES "check_book_allocations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cheque_book_page_tracking" DROP CONSTRAINT "FK_6896a4b2b0031bc5817c72e4fd0"`);
        await queryRunner.query(`ALTER TABLE "cheque_book_page_tracking" DROP CONSTRAINT "FK_c8c2d4c5e41d7ba62fc41369e06"`);
        await queryRunner.query(`ALTER TABLE "manual_book_page_tracking" DROP CONSTRAINT "FK_8e6af8a322c0feadd600355ecdf"`);
        await queryRunner.query(`ALTER TABLE "manual_book_page_tracking" DROP CONSTRAINT "FK_ed266adc74c542027d608608364"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cheque_book_page_tracking_alloc"`);
        await queryRunner.query(`DROP TABLE "cheque_book_page_tracking"`);
        await queryRunner.query(`DROP TYPE "public"."cheque_book_page_tracking_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_manual_book_page_tracking_alloc"`);
        await queryRunner.query(`DROP TABLE "manual_book_page_tracking"`);
        await queryRunner.query(`DROP TYPE "public"."manual_book_page_tracking_status_enum"`);
    }

}
