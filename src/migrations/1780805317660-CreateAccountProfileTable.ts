import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAccountProfileTable1780805317660 implements MigrationInterface {
    name = 'CreateAccountProfileTable1780805317660'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "account_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "division_dept" citext, "account_code" citext NOT NULL, "account_name" citext NOT NULL, "account_type" citext, "sub_ledger" citext, "bank_nature" citext, "currency_id" uuid NOT NULL, "financial_code_id" uuid NOT NULL, "financial_sub_profile_id" uuid, "petty_cash_expense_id" citext, "zero_balance_at_eod" boolean NOT NULL DEFAULT false, "branch_id_to_transfer" uuid, "map_to_account_id" uuid, "do_sale" boolean NOT NULL DEFAULT false, "do_purchase" boolean NOT NULL DEFAULT false, "do_receipt" boolean NOT NULL DEFAULT false, "do_payment" boolean NOT NULL DEFAULT false, "active" boolean NOT NULL DEFAULT true, "cms_bank" boolean NOT NULL DEFAULT false, "direct_remittance" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_c8a79a1a6217f52820ea53615f4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_7329d744aae1284fc51efd875b" ON "account_profiles" ("account_code") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f00c1a346b8f30536c5cdb0c24" ON "account_profiles" ("account_name") `);
        await queryRunner.query(`ALTER TABLE "account_profiles" ADD CONSTRAINT "FK_fc2e82a08a1112b6494a1ebf7f6" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "account_profiles" ADD CONSTRAINT "FK_cc7ebeb01abc0315f60d8b3429e" FOREIGN KEY ("financial_code_id") REFERENCES "financial_codes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "account_profiles" ADD CONSTRAINT "FK_1705fe7d04ddc15407208a7e47d" FOREIGN KEY ("financial_sub_profile_id") REFERENCES "financial_sub_profiles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "account_profiles" ADD CONSTRAINT "FK_d326c3cf387bcaed84d5f4624d4" FOREIGN KEY ("branch_id_to_transfer") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "account_profiles" ADD CONSTRAINT "FK_beff2e488dbe6a2ff1ab3f42eb7" FOREIGN KEY ("map_to_account_id") REFERENCES "account_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "account_profiles" DROP CONSTRAINT "FK_beff2e488dbe6a2ff1ab3f42eb7"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" DROP CONSTRAINT "FK_d326c3cf387bcaed84d5f4624d4"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" DROP CONSTRAINT "FK_1705fe7d04ddc15407208a7e47d"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" DROP CONSTRAINT "FK_cc7ebeb01abc0315f60d8b3429e"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" DROP CONSTRAINT "FK_fc2e82a08a1112b6494a1ebf7f6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f00c1a346b8f30536c5cdb0c24"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7329d744aae1284fc51efd875b"`);
        await queryRunner.query(`DROP TABLE "account_profiles"`);
    }

}
