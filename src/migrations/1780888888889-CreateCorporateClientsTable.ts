import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCorporateClientsTable1780888888889 implements MigrationInterface {
    name = 'CreateCorporateClientsTable1780888888889'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "corporate_clients" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "created_by" uuid NOT NULL,
                "updated_by" uuid NOT NULL,
                "date_of_intro" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "code" citext NOT NULL,
                "name" citext NOT NULL,
                "is_individual" boolean NOT NULL DEFAULT false,
                "credit_limit" numeric(15,2),
                "credit_days" integer,
                "temporary_credit_limit" numeric(15,2),
                "temporary_credit_days" integer,
                "permanent_credit_limit" numeric(15,2),
                "permanent_credit_days" integer,
                "address1" citext NOT NULL,
                "address2" citext,
                "address3" citext,
                "city" citext NOT NULL,
                "pin_code" citext NOT NULL,
                "kyc_approval_number" citext,
                "kyc_risk_category" citext,
                "chq_trxn_limit" numeric(15,2),
                "default_handling_charges" numeric(15,2),
                "default_agent" citext,
                "phone_no" citext,
                "block_date_from" TIMESTAMP WITH TIME ZONE,
                "establishment_date" TIMESTAMP WITH TIME ZONE,
                "remarks" text,
                "email" citext,
                "contact_name" citext,
                "designation" citext,
                "group" citext,
                "entity_type" citext,
                "pan_name" citext,
                "pan_dob" TIMESTAMP WITH TIME ZONE,
                "pan_no" citext,
                "marketing_executive" citext,
                "business_nature" citext,
                "is_tds_deducted" boolean NOT NULL DEFAULT false,
                "tds" citext,
                "tds_group" citext,
                "active" boolean NOT NULL DEFAULT true,
                "is_active" boolean NOT NULL DEFAULT false,
                "print_address" boolean NOT NULL DEFAULT false,
                "eefc_client" boolean NOT NULL DEFAULT false,
                "sale" boolean NOT NULL DEFAULT false,
                "purchase" boolean NOT NULL DEFAULT false,
                "apply_tax" boolean NOT NULL DEFAULT false,
                "igst_only" boolean NOT NULL DEFAULT false,
                "gst_no" citext,
                "sgst_no" citext,
                "igst_no" citext,
                "gst_state_id" uuid,
                "origin_branch_id" uuid,
                "location" citext,
                "web_site" citext,
                "account_holder_name" citext,
                "bank_name" citext,
                "account_number" citext,
                "ifsc_code" citext,
                "bank_address" text,
                "cancelled_cheque_copy" text,
                CONSTRAINT "PK_corporate_clients" PRIMARY KEY ("id"),
                CONSTRAINT "FK_corporate_clients_gst_state_id" FOREIGN KEY ("gst_state_id") REFERENCES "states"("id") ON DELETE SET NULL,
                CONSTRAINT "FK_corporate_clients_origin_branch_id" FOREIGN KEY ("origin_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL
            )
        `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_corporate_clients_code" ON "corporate_clients" ("code")`);
        await queryRunner.query(`CREATE INDEX "IDX_corporate_clients_name" ON "corporate_clients" ("name")`);
        await queryRunner.query(`CREATE INDEX "IDX_corporate_clients_gst_state_id" ON "corporate_clients" ("gst_state_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_corporate_clients_origin_branch_id" ON "corporate_clients" ("origin_branch_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_corporate_clients_origin_branch_id"`);
        await queryRunner.query(`DROP INDEX "IDX_corporate_clients_gst_state_id"`);
        await queryRunner.query(`DROP INDEX "IDX_corporate_clients_name"`);
        await queryRunner.query(`DROP INDEX "IDX_corporate_clients_code"`);
        await queryRunner.query(`DROP TABLE "corporate_clients"`);
    }
}
