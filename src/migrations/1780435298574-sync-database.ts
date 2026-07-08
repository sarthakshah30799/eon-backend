import { MigrationInterface, QueryRunner } from "typeorm";

export class SyncDatabase1780435298574 implements MigrationInterface {
    name = 'SyncDatabase1780435298574'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "counters" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "counter_no" integer NOT NULL DEFAULT '1', "name" citext NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "is_retail" boolean NOT NULL DEFAULT false, "is_bulk" boolean NOT NULL DEFAULT false, "is_combine" boolean NOT NULL DEFAULT false, "branch_id" uuid, CONSTRAINT "PK_910bfcbadea9cde6397e0daf996" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9cacc3ad698208a6a895891b2d" ON "counters" ("branch_id") `);
        await queryRunner.query(`CREATE TABLE "branches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "code" citext NOT NULL, "branch_number" integer NOT NULL, "address1" citext NOT NULL, "address2" citext, "address3" citext, "city" citext NOT NULL, "state" citext NOT NULL, "gst_state" citext, "pin_code" text NOT NULL, "gst_no" citext, "fx_reg_no" citext, "fx_reg_date" TIMESTAMP WITH TIME ZONE, "contact_name" citext, "contact_no" citext, "branch_email" citext, "aeon_branch_lic" citext, "location_type" citext, "cash_holding" numeric(15,2), "cash_holding_temp" numeric(15,2), "curr_holding" numeric(15,2), "curr_holding_temp" numeric(15,2), "is_head_office" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "company_id" uuid, CONSTRAINT "UQ_9c06cbb83feb2f0be6263bd47ee" UNIQUE ("code"), CONSTRAINT "UQ_7c61d1c1b1f5091d602e5cddde6" UNIQUE ("branch_number"), CONSTRAINT "PK_7f37d3b42defea97f1df0d19535" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5973f79e64a27c506b07cd84b2" ON "branches" ("company_id") `);
        await queryRunner.query(`CREATE TABLE "company" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "short_code" citext, "name" citext NOT NULL, "formerly_known_name" citext, "cin_no" citext, "pan_no" citext NOT NULL, "fx_reg_no" citext, "fx_reg_date" TIMESTAMP WITH TIME ZONE, "from_date" TIMESTAMP WITH TIME ZONE, "to_date" TIMESTAMP WITH TIME ZONE, "logo" text, "aeon_lic_no" citext, "website" citext, "email" citext, CONSTRAINT "UQ_9233994e3e400a77bb69a5a42ad" UNIQUE ("pan_no"), CONSTRAINT "PK_056f7854a7afdba7cbd6d45fc20" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "menus" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "name" citext NOT NULL, "path" text, "icon" text, "sort_order" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "parent_id" uuid, CONSTRAINT "PK_3fec3d93327f4538e0cbd4349c4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_00ccc1ed4e9fc23bc124626935" ON "menus" ("parent_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_2e67c5fc30b7214f1f8c3d87bc" ON "menus" ("is_active") `);
        await queryRunner.query(`CREATE TABLE "permissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "name" citext NOT NULL, "code" citext NOT NULL, "description" text, CONSTRAINT "UQ_8dad765629e83229da6feda1c1d" UNIQUE ("code"), CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "roles_menu_permissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "role_id" uuid, "company_id" uuid, "menu_id" uuid, "permission_id" uuid, CONSTRAINT "UQ_ec2c487ac6ddb260fc984186be7" UNIQUE ("role_id", "company_id", "menu_id", "permission_id"), CONSTRAINT "PK_05b49b61beaaff9638636cbbfd1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c41f10209aee981df615ba6e71" ON "roles_menu_permissions" ("role_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_83839f8194ed3c648b92ac0ce2" ON "roles_menu_permissions" ("company_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d9437a5e72acbab8b32b45d44d" ON "roles_menu_permissions" ("menu_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f4edaaed7a32498e278a4ac46c" ON "roles_menu_permissions" ("permission_id") `);
        await queryRunner.query(`CREATE TABLE "roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "code" citext NOT NULL, "name" citext NOT NULL, "is_admin" boolean NOT NULL DEFAULT false, "is_md" boolean NOT NULL DEFAULT false, "is_compliance" boolean NOT NULL DEFAULT false, "is_sr_finance" boolean NOT NULL DEFAULT false, "is_finance" boolean NOT NULL DEFAULT false, "is_brn_mgr" boolean NOT NULL DEFAULT false, "is_executive" boolean NOT NULL DEFAULT false, "is_card_stk" boolean NOT NULL DEFAULT false, "is_delivery_boy" boolean NOT NULL DEFAULT false, "is_cashier" boolean NOT NULL DEFAULT false, "is_sales_mgr" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "is_aeon_access" boolean NOT NULL DEFAULT false, "is_del_portal_access" boolean NOT NULL DEFAULT false, "is_del_app_access" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_f6d54f95c31b73fb1bdd8e91d0c" UNIQUE ("code"), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid, "role_id" uuid, "branch_id" uuid, "counter_id" uuid, CONSTRAINT "UQ_e64c0d97ac017d9edec15258464" UNIQUE ("user_id", "role_id", "branch_id", "counter_id"), CONSTRAINT "PK_8acd5cf26ebd158416f477de799" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_87b8888186ca9769c960e92687" ON "user_roles" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b23c65e50a758245a33ee35fda" ON "user_roles" ("role_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_fe632bf256a18c47bf99d3cf77" ON "user_roles" ("branch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_5fd0d8fb1364c4278327bccdbf" ON "user_roles" ("counter_id") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "code" citext NOT NULL, "name" citext NOT NULL, "contact_no" citext, "email" citext NOT NULL, "employee_no" citext, "designation" citext, "user_lic_no" citext, "is_active" boolean NOT NULL DEFAULT true, "last_login_date" TIMESTAMP WITH TIME ZONE, "is_locked" boolean NOT NULL DEFAULT false, "is_dormant" boolean NOT NULL DEFAULT false, "password" character varying NOT NULL, "last_login_at" TIMESTAMP, "reset_password_token" character varying, "reset_password_expires" TIMESTAMP, CONSTRAINT "UQ_1f7a2b11e29b1422a2622beab36" UNIQUE ("code"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE TYPE "public"."countries_risk_category_enum" AS ENUM('low', 'medium', 'high')`);
        await queryRunner.query(`CREATE TABLE "countries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "code" citext NOT NULL, "name" citext NOT NULL, "lrs_country_code" citext, "ctr_country_code" citext, "risk_category" "public"."countries_risk_category_enum" NOT NULL DEFAULT 'low', "restricted_country" boolean NOT NULL DEFAULT false, "grey_list_country" boolean NOT NULL DEFAULT false, "base_country" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_b47cbb5311bad9c9ae17b8c1eda" UNIQUE ("code"), CONSTRAINT "PK_b2d7006793e8697ab3ae2deff18" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_fa1376321185575cf2226b1491" ON "countries" ("name") `);
        await queryRunner.query(`CREATE TABLE "states" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "code" citext NOT NULL, "name" citext NOT NULL, "gst_state_code" citext, "ctr_state_code" citext, "country_id" uuid NOT NULL, CONSTRAINT "PK_09ab30ca0975c02656483265f4f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f3bbd0bc19bb6d8a887add0846" ON "states" ("country_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_fd995ee0bec1758b056730f3b8" ON "states" ("country_id", "name") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ad8e1b9273aa14bb1c42ca4548" ON "states" ("country_id", "code") `);
        await queryRunner.query(`ALTER TABLE "counters" ADD CONSTRAINT "FK_9cacc3ad698208a6a895891b2da" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "branches" ADD CONSTRAINT "FK_5973f79e64a27c506b07cd84b29" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "menus" ADD CONSTRAINT "FK_00ccc1ed4e9fc23bc1246269359" FOREIGN KEY ("parent_id") REFERENCES "menus"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "roles_menu_permissions" ADD CONSTRAINT "FK_c41f10209aee981df615ba6e716" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "roles_menu_permissions" ADD CONSTRAINT "FK_83839f8194ed3c648b92ac0ce2e" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "roles_menu_permissions" ADD CONSTRAINT "FK_d9437a5e72acbab8b32b45d44d9" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "roles_menu_permissions" ADD CONSTRAINT "FK_f4edaaed7a32498e278a4ac46c9" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_87b8888186ca9769c960e926870" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_b23c65e50a758245a33ee35fda1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_fe632bf256a18c47bf99d3cf771" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_5fd0d8fb1364c4278327bccdbf4" FOREIGN KEY ("counter_id") REFERENCES "counters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "states" ADD CONSTRAINT "FK_f3bbd0bc19bb6d8a887add08461" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "states" DROP CONSTRAINT "FK_f3bbd0bc19bb6d8a887add08461"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_5fd0d8fb1364c4278327bccdbf4"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_fe632bf256a18c47bf99d3cf771"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_b23c65e50a758245a33ee35fda1"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_87b8888186ca9769c960e926870"`);
        await queryRunner.query(`ALTER TABLE "roles_menu_permissions" DROP CONSTRAINT "FK_f4edaaed7a32498e278a4ac46c9"`);
        await queryRunner.query(`ALTER TABLE "roles_menu_permissions" DROP CONSTRAINT "FK_d9437a5e72acbab8b32b45d44d9"`);
        await queryRunner.query(`ALTER TABLE "roles_menu_permissions" DROP CONSTRAINT "FK_83839f8194ed3c648b92ac0ce2e"`);
        await queryRunner.query(`ALTER TABLE "roles_menu_permissions" DROP CONSTRAINT "FK_c41f10209aee981df615ba6e716"`);
        await queryRunner.query(`ALTER TABLE "menus" DROP CONSTRAINT "FK_00ccc1ed4e9fc23bc1246269359"`);
        await queryRunner.query(`ALTER TABLE "branches" DROP CONSTRAINT "FK_5973f79e64a27c506b07cd84b29"`);
        await queryRunner.query(`ALTER TABLE "counters" DROP CONSTRAINT "FK_9cacc3ad698208a6a895891b2da"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ad8e1b9273aa14bb1c42ca4548"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fd995ee0bec1758b056730f3b8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f3bbd0bc19bb6d8a887add0846"`);
        await queryRunner.query(`DROP TABLE "states"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fa1376321185575cf2226b1491"`);
        await queryRunner.query(`DROP TABLE "countries"`);
        await queryRunner.query(`DROP TYPE "public"."countries_risk_category_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5fd0d8fb1364c4278327bccdbf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fe632bf256a18c47bf99d3cf77"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b23c65e50a758245a33ee35fda"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_87b8888186ca9769c960e92687"`);
        await queryRunner.query(`DROP TABLE "user_roles"`);
        await queryRunner.query(`DROP TABLE "roles"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f4edaaed7a32498e278a4ac46c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d9437a5e72acbab8b32b45d44d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_83839f8194ed3c648b92ac0ce2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c41f10209aee981df615ba6e71"`);
        await queryRunner.query(`DROP TABLE "roles_menu_permissions"`);
        await queryRunner.query(`DROP TABLE "permissions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2e67c5fc30b7214f1f8c3d87bc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_00ccc1ed4e9fc23bc124626935"`);
        await queryRunner.query(`DROP TABLE "menus"`);
        await queryRunner.query(`DROP TABLE "company"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5973f79e64a27c506b07cd84b2"`);
        await queryRunner.query(`DROP TABLE "branches"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9cacc3ad698208a6a895891b2d"`);
        await queryRunner.query(`DROP TABLE "counters"`);
    }

}
