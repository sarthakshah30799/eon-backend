import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCurrencyGrpRates1782649215452 implements MigrationInterface {
    name = 'AddCurrencyGrpRates1782649215452'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "currency_rate_groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "code" citext NOT NULL, "name" citext NOT NULL, "description" text, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_0c2859b7dde1652d0202962806f" UNIQUE ("code"), CONSTRAINT "PK_309ab4eb5256041cdbdd02e5b42" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0c2859b7dde1652d0202962806" ON "currency_rate_groups" ("code") `);
        await queryRunner.query(`CREATE TYPE "public"."currency_rates_provider_enum" AS ENUM('TICKER', 'FOREX')`);
        await queryRunner.query(`CREATE TABLE "currency_rates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "currency_id" uuid NOT NULL, "provider" "public"."currency_rates_provider_enum" NOT NULL, "base_buy_rate" numeric NOT NULL, "base_sale_rate" numeric NOT NULL, "base_rate" numeric, "is_active" boolean NOT NULL DEFAULT true, "notes" text, "entered_by" uuid, CONSTRAINT "PK_43636e55d92705f102d2a6e75a0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cbf80da0638d81beee7fabe295" ON "currency_rates" ("currency_id") `);
        await queryRunner.query(`ALTER TABLE "currencies" ADD "pricing_group_id" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_0672115c170b7caba126333421" ON "currencies" ("pricing_group_id") `);
        await queryRunner.query(`ALTER TABLE "currencies" ADD CONSTRAINT "FK_0672115c170b7caba1263334213" FOREIGN KEY ("pricing_group_id") REFERENCES "currency_rate_groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "currency_rates" ADD CONSTRAINT "FK_cbf80da0638d81beee7fabe2951" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "currency_rates" ADD CONSTRAINT "FK_47ea82577334f5515d673f84402" FOREIGN KEY ("entered_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "currency_rates" DROP CONSTRAINT "FK_47ea82577334f5515d673f84402"`);
        await queryRunner.query(`ALTER TABLE "currency_rates" DROP CONSTRAINT "FK_cbf80da0638d81beee7fabe2951"`);
        await queryRunner.query(`ALTER TABLE "currencies" DROP CONSTRAINT "FK_0672115c170b7caba1263334213"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0672115c170b7caba126333421"`);
        await queryRunner.query(`ALTER TABLE "currencies" DROP COLUMN "pricing_group_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cbf80da0638d81beee7fabe295"`);
        await queryRunner.query(`DROP TABLE "currency_rates"`);
        await queryRunner.query(`DROP TYPE "public"."currency_rates_provider_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0c2859b7dde1652d0202962806"`);
        await queryRunner.query(`DROP TABLE "currency_rate_groups"`);
    }

}
