import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPurposeMaster1784888758222 implements MigrationInterface {
    name = 'AddPurposeMaster1784888758222'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."purpose_slabs_rate_type_enum" AS ENUM('PERCENT', 'RUPEES')`);
        await queryRunner.query(`CREATE TABLE "purpose_slabs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "purpose_id" uuid NOT NULL, "sort_order" integer NOT NULL DEFAULT '0', "from_amount" numeric(18,2) NOT NULL, "to_amount" numeric(18,2), "rate" numeric(18,2) NOT NULL, "rate_type" "public"."purpose_slabs_rate_type_enum" NOT NULL DEFAULT 'PERCENT', CONSTRAINT "UQ_purpose_slabs_purpose_id_sort_order" UNIQUE ("purpose_id", "sort_order"), CONSTRAINT "CHK_purpose_slabs_from_to" CHECK ("to_amount" IS NULL OR "to_amount" >= "from_amount"), CONSTRAINT "PK_85f0b93b93d97ac289268e3ee22" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_purpose_slabs_purpose_id" ON "purpose_slabs" ("purpose_id") `);
        await queryRunner.query(`CREATE TYPE "public"."purpose_rate_type_enum" AS ENUM('PERCENT', 'RUPEES')`);
        await queryRunner.query(`CREATE TABLE "purposes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "code" citext NOT NULL, "description" citext NOT NULL, "threshold" numeric(18,2) NOT NULL DEFAULT '0', "rate" numeric(18,2) NOT NULL DEFAULT '0', "rate_type" "public"."purpose_rate_type_enum" NOT NULL DEFAULT 'PERCENT', "transaction_type" "public"."transactions_transaction_type_enum" NOT NULL, CONSTRAINT "CHK_purposes_code_length" CHECK (char_length("code") = 2), CONSTRAINT "PK_2586481eca3a09f84fcf5fa2353" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_purposes_transaction_type" ON "purposes" ("transaction_type") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_purposes_code" ON "purposes" ("code") `);
        await queryRunner.query(`ALTER TABLE "purpose_slabs" ADD CONSTRAINT "FK_purpose_slabs_purpose_id" FOREIGN KEY ("purpose_id") REFERENCES "purposes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "purpose_slabs" DROP CONSTRAINT "FK_purpose_slabs_purpose_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_purposes_code"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_purposes_transaction_type"`);
        await queryRunner.query(`DROP TABLE "purposes"`);
        await queryRunner.query(`DROP TYPE "public"."purpose_rate_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_purpose_slabs_purpose_id"`);
        await queryRunner.query(`DROP TABLE "purpose_slabs"`);
        await queryRunner.query(`DROP TYPE "public"."purpose_slabs_rate_type_enum"`);
    }

}
