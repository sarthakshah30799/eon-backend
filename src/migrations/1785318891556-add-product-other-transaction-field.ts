import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProductOtherTransactionField1785318891556 implements MigrationInterface {
  name = "AddProductOtherTransactionField1785318891556";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ADD "available_in_other_transaction" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."purpose_slabs_rate_type_enum" RENAME TO "purpose_slabs_rate_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."purpose_slabs_rate_type_enum" AS ENUM('PERCENT', 'RUPEES')`,
    );
    await queryRunner.query(
      `ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" TYPE "public"."purpose_slabs_rate_type_enum" USING "rate_type"::"text"::"public"."purpose_slabs_rate_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" SET DEFAULT 'PERCENT'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."purpose_slabs_rate_type_enum_old"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."purpose_slabs_rate_type_enum_old" AS ENUM('PERCENT', 'RUPEES')`,
    );
    await queryRunner.query(
      `ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" TYPE "public"."purpose_slabs_rate_type_enum_old" USING "rate_type"::"text"::"public"."purpose_slabs_rate_type_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" SET DEFAULT 'PERCENT'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."purpose_slabs_rate_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."purpose_slabs_rate_type_enum_old" RENAME TO "purpose_slabs_rate_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN "available_in_other_transaction"`,
    );
  }
}
