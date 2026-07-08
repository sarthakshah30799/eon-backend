import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFinancialTables1780726191256 implements MigrationInterface {
    name = 'CreateFinancialTables1780726191256'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "financial_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "financial_type" citext NOT NULL, "financial_code" citext NOT NULL, "financial_name" citext NOT NULL, "default_sign" citext NOT NULL, "priority" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_31765ddd7e59d18c8c3cc1f0541" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c98f5a986dc47837817ab8598b" ON "financial_codes" ("financial_code") `);
        await queryRunner.query(`CREATE TABLE "financial_sub_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "financial_sub_code" citext NOT NULL, "financial_sub_name" citext NOT NULL, "priority" integer NOT NULL DEFAULT '0', "financial_code_id" uuid NOT NULL, CONSTRAINT "PK_73c3ed011d4d2b83847b8cafb68" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "financial_sub_profiles" ADD CONSTRAINT "FK_51507fe4f978fdb45d08eab6570" FOREIGN KEY ("financial_code_id") REFERENCES "financial_codes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "financial_sub_profiles" DROP CONSTRAINT "FK_51507fe4f978fdb45d08eab6570"`);
        await queryRunner.query(`DROP TABLE "financial_sub_profiles"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c98f5a986dc47837817ab8598b"`);
        await queryRunner.query(`DROP TABLE "financial_codes"`);
    }

}
