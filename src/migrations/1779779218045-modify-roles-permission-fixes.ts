import { MigrationInterface, QueryRunner } from "typeorm";

export class ModifyRolesPermissionFixes1779779218045 implements MigrationInterface {
    name = 'ModifyRolesPermissionFixes1779779218045'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "roles_menu_permissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "role_id" uuid, "company_id" uuid, "menu_id" uuid, "permission_id" uuid, CONSTRAINT "UQ_ec2c487ac6ddb260fc984186be7" UNIQUE ("role_id", "company_id", "menu_id", "permission_id"), CONSTRAINT "PK_05b49b61beaaff9638636cbbfd1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c41f10209aee981df615ba6e71" ON "roles_menu_permissions" ("role_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_83839f8194ed3c648b92ac0ce2" ON "roles_menu_permissions" ("company_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d9437a5e72acbab8b32b45d44d" ON "roles_menu_permissions" ("menu_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f4edaaed7a32498e278a4ac46c" ON "roles_menu_permissions" ("permission_id") `);
        await queryRunner.query(`CREATE TABLE "roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "createdBy" uuid NOT NULL, "updatedBy" uuid NOT NULL, "name" citext NOT NULL, "code" citext NOT NULL, "description" text, CONSTRAINT "UQ_f6d54f95c31b73fb1bdd8e91d0c" UNIQUE ("code"), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid, "role_id" uuid, "branch_id" uuid, "counter_id" uuid, CONSTRAINT "UQ_e64c0d97ac017d9edec15258464" UNIQUE ("user_id", "role_id", "branch_id", "counter_id"), CONSTRAINT "PK_8acd5cf26ebd158416f477de799" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_87b8888186ca9769c960e92687" ON "user_roles" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b23c65e50a758245a33ee35fda" ON "user_roles" ("role_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_fe632bf256a18c47bf99d3cf77" ON "user_roles" ("branch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_5fd0d8fb1364c4278327bccdbf" ON "user_roles" ("counter_id") `);
        await queryRunner.query(`ALTER TABLE "counters" ADD "branch_id" uuid`);
        await queryRunner.query(`ALTER TABLE "branches" ADD "company_id" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_9cacc3ad698208a6a895891b2d" ON "counters" ("branch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_5973f79e64a27c506b07cd84b2" ON "branches" ("company_id") `);
        await queryRunner.query(`ALTER TABLE "counters" ADD CONSTRAINT "FK_9cacc3ad698208a6a895891b2da" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "branches" ADD CONSTRAINT "FK_5973f79e64a27c506b07cd84b29" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "roles_menu_permissions" ADD CONSTRAINT "FK_c41f10209aee981df615ba6e716" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "roles_menu_permissions" ADD CONSTRAINT "FK_83839f8194ed3c648b92ac0ce2e" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "roles_menu_permissions" ADD CONSTRAINT "FK_d9437a5e72acbab8b32b45d44d9" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "roles_menu_permissions" ADD CONSTRAINT "FK_f4edaaed7a32498e278a4ac46c9" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_87b8888186ca9769c960e926870" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_b23c65e50a758245a33ee35fda1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_fe632bf256a18c47bf99d3cf771" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_5fd0d8fb1364c4278327bccdbf4" FOREIGN KEY ("counter_id") REFERENCES "counters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`DROP TABLE "user_menu_permissions"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_menu_permissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid, "branch_id" uuid, "counter_id" uuid, "menu_id" uuid, "permission_id" uuid, CONSTRAINT "UQ_fb36d93f8c73a669f5c22ddbbe1" UNIQUE ("user_id", "branch_id", "counter_id", "menu_id", "permission_id"), CONSTRAINT "PK_bc589fa065ed98f378f7dcb2699" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_606e5c4af533d18775d2b3306d" ON "user_menu_permissions" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_2b6fafb267743641cd8ca30356" ON "user_menu_permissions" ("branch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_5dc4ddd45662a4a02db47638cc" ON "user_menu_permissions" ("counter_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_08d97cb7e8e018c483cd03e961" ON "user_menu_permissions" ("menu_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f41bfa186803e835549397646a" ON "user_menu_permissions" ("permission_id") `);
        await queryRunner.query(`ALTER TABLE "user_menu_permissions" ADD CONSTRAINT "FK_606e5c4af533d18775d2b3306d1" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_menu_permissions" ADD CONSTRAINT "FK_2b6fafb267743641cd8ca303561" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_menu_permissions" ADD CONSTRAINT "FK_5dc4ddd45662a4a02db47638cc4" FOREIGN KEY ("counter_id") REFERENCES "counters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_menu_permissions" ADD CONSTRAINT "FK_08d97cb7e8e018c483cd03e9611" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_menu_permissions" ADD CONSTRAINT "FK_f41bfa186803e835549397646a6" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_5fd0d8fb1364c4278327bccdbf4"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_fe632bf256a18c47bf99d3cf771"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_b23c65e50a758245a33ee35fda1"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_87b8888186ca9769c960e926870"`);
        await queryRunner.query(`ALTER TABLE "roles_menu_permissions" DROP CONSTRAINT "FK_f4edaaed7a32498e278a4ac46c9"`);
        await queryRunner.query(`ALTER TABLE "roles_menu_permissions" DROP CONSTRAINT "FK_d9437a5e72acbab8b32b45d44d9"`);
        await queryRunner.query(`ALTER TABLE "roles_menu_permissions" DROP CONSTRAINT "FK_83839f8194ed3c648b92ac0ce2e"`);
        await queryRunner.query(`ALTER TABLE "roles_menu_permissions" DROP CONSTRAINT "FK_c41f10209aee981df615ba6e716"`);
        await queryRunner.query(`ALTER TABLE "branches" DROP CONSTRAINT "FK_5973f79e64a27c506b07cd84b29"`);
        await queryRunner.query(`ALTER TABLE "counters" DROP CONSTRAINT "FK_9cacc3ad698208a6a895891b2da"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5973f79e64a27c506b07cd84b2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9cacc3ad698208a6a895891b2d"`);
        await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN "company_id"`);
        await queryRunner.query(`ALTER TABLE "counters" DROP COLUMN "branch_id"`);
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
    }

}
