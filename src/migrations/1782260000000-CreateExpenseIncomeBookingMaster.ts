import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateExpenseIncomeBookingMaster1782260000000 implements MigrationInterface {
    name = 'CreateExpenseIncomeBookingMaster1782260000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "expense_income_booking_masters" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(), 
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), 
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), 
                "created_by" uuid NOT NULL, 
                "updated_by" uuid NOT NULL, 
                "type" citext NOT NULL, 
                "interstate_transaction" boolean NOT NULL DEFAULT false, 
                "code" citext NOT NULL, 
                "description" text, 
                "applicable_customer" boolean NOT NULL DEFAULT false, 
                "applicable_vendor" boolean NOT NULL DEFAULT false, 
                "applicable_employee" boolean NOT NULL DEFAULT false, 
                "applicable_agent" boolean NOT NULL DEFAULT false, 
                "applicable_tc_issuer" boolean NOT NULL DEFAULT false, 
                "active" boolean NOT NULL DEFAULT true, 
                "allow_rec_pay" boolean NOT NULL DEFAULT false, 
                "total_gst" numeric(5,2) NOT NULL DEFAULT '0', 
                "tds_applicable" boolean NOT NULL DEFAULT false, 
                "tds_value" numeric(5,2) NOT NULL DEFAULT '0', 
                "tds_account_id" uuid, 
                "from" TIMESTAMP WITH TIME ZONE, 
                "to" TIMESTAMP WITH TIME ZONE, 
                CONSTRAINT "PK_be8781133009e586e5ae84d5e73" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_443b0250e83f054a7eaa416152" ON "expense_income_booking_masters" ("type") `);
        await queryRunner.query(`CREATE INDEX "IDX_aa263a2324d5b1be828c88a65b" ON "expense_income_booking_masters" ("code") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f894bb9fdbfa2d21ace7245f0f" ON "expense_income_booking_masters" ("type", "code") `);
        await queryRunner.query(`ALTER TABLE "expense_income_booking_masters" ADD CONSTRAINT "FK_592fbfa8d4e4193f3085b8b3cc9" FOREIGN KEY ("tds_account_id") REFERENCES "account_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        
        // Add audit trigger
        await queryRunner.query(`
            CREATE TRIGGER expense_income_booking_masters_audit_trigger
            AFTER INSERT OR UPDATE OR DELETE ON "expense_income_booking_masters"
            FOR EACH ROW
            EXECUTE FUNCTION audit_trigger_func();
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER IF EXISTS expense_income_booking_masters_audit_trigger ON "expense_income_booking_masters"`);
        await queryRunner.query(`ALTER TABLE "expense_income_booking_masters" DROP CONSTRAINT "FK_592fbfa8d4e4193f3085b8b3cc9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f894bb9fdbfa2d21ace7245f0f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aa263a2324d5b1be828c88a65b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_443b0250e83f054a7eaa416152"`);
        await queryRunner.query(`DROP TABLE "expense_income_booking_masters"`);
    }
}
