import { MigrationInterface, QueryRunner } from "typeorm";

export class AlignEntitySchemas1780100000000 implements MigrationInterface {
    name = 'AlignEntitySchemas1780100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Company Table
        await queryRunner.query(`ALTER TABLE "company" DROP COLUMN IF EXISTS "name"`);
        await queryRunner.query(`ALTER TABLE "company" DROP COLUMN IF EXISTS "designation"`);
        await queryRunner.query(`ALTER TABLE "company" DROP COLUMN IF EXISTS "rbiName"`);
        await queryRunner.query(`ALTER TABLE "company" DROP COLUMN IF EXISTS "rbiPlace"`);
        await queryRunner.query(`ALTER TABLE "company" DROP COLUMN IF EXISTS "country"`);
        await queryRunner.query(`ALTER TABLE "company" DROP COLUMN IF EXISTS "address1"`);
        await queryRunner.query(`ALTER TABLE "company" DROP COLUMN IF EXISTS "address2"`);
        await queryRunner.query(`ALTER TABLE "company" DROP COLUMN IF EXISTS "address3"`);
        await queryRunner.query(`ALTER TABLE "company" DROP COLUMN IF EXISTS "pincode"`);
        await queryRunner.query(`ALTER TABLE "company" DROP COLUMN IF EXISTS "city"`);
        await queryRunner.query(`ALTER TABLE "company" DROP COLUMN IF EXISTS "state"`);

        await queryRunner.query(`ALTER TABLE "company" ADD COLUMN "shortCode" citext`);
        await queryRunner.query(`ALTER TABLE "company" ADD COLUMN "companyName" citext NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "company" ADD COLUMN "formerlyKnownName" citext`);
        await queryRunner.query(`ALTER TABLE "company" ADD COLUMN "cinNo" citext`);
        await queryRunner.query(`ALTER TABLE "company" ADD COLUMN "panNo" citext`);
        await queryRunner.query(`ALTER TABLE "company" ADD COLUMN "fxRegNo" citext`);
        await queryRunner.query(`ALTER TABLE "company" ADD COLUMN "fxRegDate" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "company" ADD COLUMN "fromDate" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "company" ADD COLUMN "toDate" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "company" ADD COLUMN "logo" text`);
        await queryRunner.query(`ALTER TABLE "company" ADD COLUMN "aeonLicNo" citext`);
        await queryRunner.query(`ALTER TABLE "company" ADD COLUMN "website" citext`);
        await queryRunner.query(`ALTER TABLE "company" ADD COLUMN "emailId" citext`);

        // 2. Branches Table

        await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN IF EXISTS "gstStateCode"`);
        await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN IF EXISTS "countryCode1"`);
        await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN IF EXISTS "phoneNumber1"`);
        await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN IF EXISTS "countryCode2"`);
        await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN IF EXISTS "phoneNumber2"`);
        await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN IF EXISTS "contactPersonName"`);
        await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN IF EXISTS "contactPersonCountryCode"`);
        await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN IF EXISTS "contactPersonPhone"`);
        await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN IF EXISTS "operationGroup"`);
        await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN IF EXISTS "country"`);
        await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN IF EXISTS "stateCode"`);


        await queryRunner.query(`ALTER TABLE "branches" ADD COLUMN "gstState" citext`);
        await queryRunner.query(`ALTER TABLE "branches" ADD COLUMN "gstNo" citext`);
        await queryRunner.query(`ALTER TABLE "branches" ADD COLUMN "fxRegNo" citext`);
        await queryRunner.query(`ALTER TABLE "branches" ADD COLUMN "fxRegDate" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "branches" ADD COLUMN "contactName" citext`);
        await queryRunner.query(`ALTER TABLE "branches" ADD COLUMN "contactNo" citext`);
        await queryRunner.query(`ALTER TABLE "branches" ADD COLUMN "branchEmailId" citext`);
        await queryRunner.query(`ALTER TABLE "branches" ADD COLUMN "aeonBranchLic" citext`);
        await queryRunner.query(`ALTER TABLE "branches" ADD COLUMN "locationType" citext`);
        await queryRunner.query(`ALTER TABLE "branches" ADD COLUMN "cashHolding" NUMERIC(15,2)`);
        await queryRunner.query(`ALTER TABLE "branches" ADD COLUMN "cashHoldingTemp" NUMERIC(15,2)`);
        await queryRunner.query(`ALTER TABLE "branches" ADD COLUMN "currHolding" NUMERIC(15,2)`);
        await queryRunner.query(`ALTER TABLE "branches" ADD COLUMN "currHoldingTemp" NUMERIC(15,2)`);
        await queryRunner.query(`ALTER TABLE "branches" ADD COLUMN "isHeadOffice" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "branches" ADD COLUMN "isActive" boolean NOT NULL DEFAULT true`);

        // 3. Counters Table
        await queryRunner.query(`ALTER TABLE "counters" DROP COLUMN IF EXISTS "name"`);
        await queryRunner.query(`ALTER TABLE "counters" DROP COLUMN IF EXISTS "description"`);
        await queryRunner.query(`ALTER TABLE "counters" DROP COLUMN IF EXISTS "remark"`);
        await queryRunner.query(`ALTER TABLE "counters" DROP COLUMN IF EXISTS "status"`);

        await queryRunner.query(`ALTER TABLE "counters" ADD COLUMN "counterNo" integer NOT NULL DEFAULT 1`);
        await queryRunner.query(`ALTER TABLE "counters" ADD COLUMN "counterName" citext NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "counters" ADD COLUMN "isActive" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "counters" ADD COLUMN "isRetailCnt" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "counters" ADD COLUMN "isBulkCnt" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "counters" ADD COLUMN "isCombineCnt" boolean NOT NULL DEFAULT false`);

        // 4. Roles Table
        await queryRunner.query(`ALTER TABLE "roles" DROP CONSTRAINT IF EXISTS "UQ_f6d54f95c31b73fb1bdd8e91d0c"`);
        await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN IF EXISTS "name"`);
        await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN IF EXISTS "code"`);
        await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN IF EXISTS "description"`);
        await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN IF EXISTS "isActive"`);

        await queryRunner.query(`ALTER TABLE "roles" ADD COLUMN "userGroupCode" citext NOT NULL UNIQUE`);
        await queryRunner.query(`ALTER TABLE "roles" ADD COLUMN "userGroupName" citext NOT NULL`);
        await queryRunner.query(`ALTER TABLE "roles" ADD COLUMN "isAdminGrp" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "roles" ADD COLUMN "isMdGroup" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "roles" ADD COLUMN "isComplianceGrp" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "roles" ADD COLUMN "isSrFinanceGrp" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "roles" ADD COLUMN "isFinanceGrp" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "roles" ADD COLUMN "isBrnMgrGrp" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "roles" ADD COLUMN "isExecutiveGrp" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "roles" ADD COLUMN "isCardStkGrp" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "roles" ADD COLUMN "isDeliveryBoyGrp" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "roles" ADD COLUMN "isCashierGrp" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "roles" ADD COLUMN "isSalesMgrGrp" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "roles" ADD COLUMN "isActive" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "roles" ADD COLUMN "isAeonAccess" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "roles" ADD COLUMN "isDelPortalAccess" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "roles" ADD COLUMN "isDelAppAccess" boolean NOT NULL DEFAULT false`);

        // 5. Users Table
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "UQ_97672ac88f789774dd47f7c8be3"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_3676155292d72c67cd4e090514"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_2665cffe3bfa664d1e23da6cd1"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "firstName"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "lastName"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "email"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "countryCode"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "phoneNumber"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "status"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "isHo"`);

        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "userName" citext NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "userGroupCode" citext`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "contactNo" citext`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "emailId" citext NOT NULL UNIQUE`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "employeeNo" citext`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "designation" citext`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "branchCode" citext`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "userLicNo" citext`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "isActive" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "lastLoginDate" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "isLocked" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "isDormant" boolean NOT NULL DEFAULT false`);

        await queryRunner.query(`CREATE INDEX "IDX_emailId" ON "users" ("emailId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No down migration required for this conversion.
    }
}
