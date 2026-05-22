import { MigrationInterface, QueryRunner } from "typeorm";

export class UserCompanyBranchCounterPermissionSchema1779459163183 implements MigrationInterface {
    name = 'UserCompanyBranchCounterPermissionSchema1779459163183'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('pending', 'active', 'inactive')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "createdBy" uuid NOT NULL, "updatedBy" uuid NOT NULL, "userCode" citext NOT NULL, "password" character varying NOT NULL, "firstName" citext NOT NULL, "lastName" citext NOT NULL, "email" citext NOT NULL, "countryCode" character(2) NOT NULL DEFAULT 'IN', "phoneNumber" text NOT NULL, "status" "public"."users_status_enum" NOT NULL DEFAULT 'pending', "isHo" boolean NOT NULL DEFAULT false, "lastLoginAt" TIMESTAMP, CONSTRAINT "UQ_e568829997a1d09d009346bc47d" UNIQUE ("userCode"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_3676155292d72c67cd4e090514" ON "users" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_2665cffe3bfa664d1e23da6cd1" ON "users" ("isHo") `);
        await queryRunner.query(`CREATE TABLE "branches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "createdBy" uuid NOT NULL, "updatedBy" uuid NOT NULL, "branchCode" citext NOT NULL, "branchNumber" integer NOT NULL, "address1" citext NOT NULL, "address2" citext, "address3" citext, "pincode" text NOT NULL, "city" citext NOT NULL, "state" citext NOT NULL, "country" citext NOT NULL DEFAULT 'India', "stateCode" character(2) NOT NULL, "gstStateCode" text NOT NULL, "countryCode1" character(2) NOT NULL DEFAULT 'IN', "phoneNumber1" text NOT NULL, "countryCode2" character(2) NOT NULL DEFAULT 'IN', "phoneNumber2" text, "contactPersonName" citext, "contactPersonCountryCode" character(2) NOT NULL DEFAULT 'IN', "contactPersonPhone" text, "operationGroup" citext, CONSTRAINT "UQ_a26e570967b3ad151f0f1cdbd11" UNIQUE ("branchCode"), CONSTRAINT "UQ_a4e4efc2b2e753907f90e8e0d62" UNIQUE ("branchNumber"), CONSTRAINT "PK_7f37d3b42defea97f1df0d19535" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2ea1b0804435d8f458d3206c14" ON "branches" ("stateCode") `);
        await queryRunner.query(`CREATE INDEX "IDX_585b00f206aa677621ed77b3fa" ON "branches" ("gstStateCode") `);
        await queryRunner.query(`CREATE INDEX "IDX_b646d013c55ef094bfec1144c0" ON "branches" ("operationGroup") `);
        await queryRunner.query(`CREATE TYPE "public"."counters_status_enum" AS ENUM('pending', 'active', 'inactive')`);
        await queryRunner.query(`CREATE TABLE "counters" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "createdBy" uuid NOT NULL, "updatedBy" uuid NOT NULL, "counterCode" citext NOT NULL, "name" citext NOT NULL, "description" text, "remark" text, "status" "public"."counters_status_enum" NOT NULL DEFAULT 'pending', CONSTRAINT "UQ_4f0e455d0be4e0fe48e47d84daf" UNIQUE ("counterCode"), CONSTRAINT "PK_910bfcbadea9cde6397e0daf996" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7608c0f1a1ff1f689b61407055" ON "counters" ("status") `);
        await queryRunner.query(`CREATE TABLE "menus" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "createdBy" uuid NOT NULL, "updatedBy" uuid NOT NULL, "name" citext NOT NULL, "path" text, "icon" text, "sortOrder" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "parent_id" uuid, CONSTRAINT "PK_3fec3d93327f4538e0cbd4349c4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_00ccc1ed4e9fc23bc124626935" ON "menus" ("parent_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_354278dca1b9b735a76f743412" ON "menus" ("isActive") `);
        await queryRunner.query(`CREATE TABLE "permissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "createdBy" uuid NOT NULL, "updatedBy" uuid NOT NULL, "name" citext NOT NULL, "code" citext NOT NULL, "description" text, CONSTRAINT "UQ_8dad765629e83229da6feda1c1d" UNIQUE ("code"), CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_menu_permissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid, "branch_id" uuid, "counter_id" uuid, "menu_id" uuid, "permission_id" uuid, CONSTRAINT "UQ_fb36d93f8c73a669f5c22ddbbe1" UNIQUE ("user_id", "branch_id", "counter_id", "menu_id", "permission_id"), CONSTRAINT "PK_bc589fa065ed98f378f7dcb2699" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_606e5c4af533d18775d2b3306d" ON "user_menu_permissions" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_2b6fafb267743641cd8ca30356" ON "user_menu_permissions" ("branch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_5dc4ddd45662a4a02db47638cc" ON "user_menu_permissions" ("counter_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_08d97cb7e8e018c483cd03e961" ON "user_menu_permissions" ("menu_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f41bfa186803e835549397646a" ON "user_menu_permissions" ("permission_id") `);
        await queryRunner.query(`CREATE TABLE "company" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "createdBy" uuid NOT NULL, "updatedBy" uuid NOT NULL, "name" citext NOT NULL, "designation" citext, "rbiName" citext, "rbiPlace" citext, "address1" citext NOT NULL, "address2" citext, "address3" citext, "pincode" text NOT NULL, "city" citext NOT NULL, "state" citext NOT NULL, "country" citext NOT NULL DEFAULT 'India', CONSTRAINT "PK_056f7854a7afdba7cbd6d45fc20" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "menus" ADD CONSTRAINT "FK_00ccc1ed4e9fc23bc1246269359" FOREIGN KEY ("parent_id") REFERENCES "menus"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_menu_permissions" ADD CONSTRAINT "FK_606e5c4af533d18775d2b3306d1" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_menu_permissions" ADD CONSTRAINT "FK_2b6fafb267743641cd8ca303561" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_menu_permissions" ADD CONSTRAINT "FK_5dc4ddd45662a4a02db47638cc4" FOREIGN KEY ("counter_id") REFERENCES "counters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_menu_permissions" ADD CONSTRAINT "FK_08d97cb7e8e018c483cd03e9611" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_menu_permissions" ADD CONSTRAINT "FK_f41bfa186803e835549397646a6" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_menu_permissions" DROP CONSTRAINT "FK_f41bfa186803e835549397646a6"`);
        await queryRunner.query(`ALTER TABLE "user_menu_permissions" DROP CONSTRAINT "FK_08d97cb7e8e018c483cd03e9611"`);
        await queryRunner.query(`ALTER TABLE "user_menu_permissions" DROP CONSTRAINT "FK_5dc4ddd45662a4a02db47638cc4"`);
        await queryRunner.query(`ALTER TABLE "user_menu_permissions" DROP CONSTRAINT "FK_2b6fafb267743641cd8ca303561"`);
        await queryRunner.query(`ALTER TABLE "user_menu_permissions" DROP CONSTRAINT "FK_606e5c4af533d18775d2b3306d1"`);
        await queryRunner.query(`ALTER TABLE "menus" DROP CONSTRAINT "FK_00ccc1ed4e9fc23bc1246269359"`);
        await queryRunner.query(`DROP TABLE "company"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f41bfa186803e835549397646a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_08d97cb7e8e018c483cd03e961"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5dc4ddd45662a4a02db47638cc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2b6fafb267743641cd8ca30356"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_606e5c4af533d18775d2b3306d"`);
        await queryRunner.query(`DROP TABLE "user_menu_permissions"`);
        await queryRunner.query(`DROP TABLE "permissions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_354278dca1b9b735a76f743412"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_00ccc1ed4e9fc23bc124626935"`);
        await queryRunner.query(`DROP TABLE "menus"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7608c0f1a1ff1f689b61407055"`);
        await queryRunner.query(`DROP TABLE "counters"`);
        await queryRunner.query(`DROP TYPE "public"."counters_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b646d013c55ef094bfec1144c0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_585b00f206aa677621ed77b3fa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2ea1b0804435d8f458d3206c14"`);
        await queryRunner.query(`DROP TABLE "branches"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2665cffe3bfa664d1e23da6cd1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3676155292d72c67cd4e090514"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
    }

}
