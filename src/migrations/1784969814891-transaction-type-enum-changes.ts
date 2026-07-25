import { MigrationInterface, QueryRunner } from "typeorm";

export class TransactionTypeEnumChanges1784969814891 implements MigrationInterface {
    name = 'TransactionTypeEnumChanges1784969814891'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_purposes_corporate"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_purposes_individual"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_purposes_sell"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_purposes_purchase"`);
        await queryRunner.query(`ALTER TYPE "public"."purpose_slabs_rate_type_enum" RENAME TO "purpose_slabs_rate_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."purpose_slabs_rate_type_enum" AS ENUM('PERCENT', 'RUPEES')`);
        await queryRunner.query(`ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" TYPE "public"."purpose_slabs_rate_type_enum" USING "rate_type"::"text"::"public"."purpose_slabs_rate_type_enum"`);
        await queryRunner.query(`ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" SET DEFAULT 'PERCENT'`);
        await queryRunner.query(`DROP TYPE "public"."purpose_slabs_rate_type_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."purpose_rate_type_enum" RENAME TO "purpose_rate_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."purposes_rate_type_enum" AS ENUM('PERCENT', 'RUPEES')`);
        await queryRunner.query(`ALTER TABLE "purposes" ALTER COLUMN "rate_type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "purposes" ALTER COLUMN "rate_type" TYPE "public"."purposes_rate_type_enum" USING "rate_type"::"text"::"public"."purposes_rate_type_enum"`);
        await queryRunner.query(`ALTER TABLE "purposes" ALTER COLUMN "rate_type" SET DEFAULT 'PERCENT'`);
        await queryRunner.query(`DROP TYPE "public"."purpose_rate_type_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."purpose_rate_type_enum_old" AS ENUM('PERCENT', 'RUPEES')`);
        await queryRunner.query(`ALTER TABLE "purposes" ALTER COLUMN "rate_type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "purposes" ALTER COLUMN "rate_type" TYPE "public"."purpose_rate_type_enum_old" USING "rate_type"::"text"::"public"."purpose_rate_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "purposes" ALTER COLUMN "rate_type" SET DEFAULT 'PERCENT'`);
        await queryRunner.query(`DROP TYPE "public"."purposes_rate_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."purpose_rate_type_enum_old" RENAME TO "purpose_rate_type_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."purpose_slabs_rate_type_enum_old" AS ENUM('PERCENT', 'RUPEES')`);
        await queryRunner.query(`ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" TYPE "public"."purpose_slabs_rate_type_enum_old" USING "rate_type"::"text"::"public"."purpose_slabs_rate_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" SET DEFAULT 'PERCENT'`);
        await queryRunner.query(`DROP TYPE "public"."purpose_slabs_rate_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."purpose_slabs_rate_type_enum_old" RENAME TO "purpose_slabs_rate_type_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_purposes_purchase" ON "purposes" ("purchase") `);
        await queryRunner.query(`CREATE INDEX "IDX_purposes_sell" ON "purposes" ("sell") `);
        await queryRunner.query(`CREATE INDEX "IDX_purposes_individual" ON "purposes" ("individual") `);
        await queryRunner.query(`CREATE INDEX "IDX_purposes_corporate" ON "purposes" ("corporate") `);
    }

}
