require('dotenv').config();

const { Client } = require('pg');
const bcrypt = require('bcrypt');

function getRequiredEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is not defined`);
  }
  return value;
}

function getNumberEnv(key) {
  const value = getRequiredEnv(key);
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${key} is not a valid number`);
  }
  return parsed;
}

function getBooleanEnv(key) {
  const value = process.env[key];
  if (value === undefined) {
    return undefined;
  }
  return value.toLowerCase() === 'true';
}

function getSslConfig() {
  const sslEnabled = getBooleanEnv('DB_SSL') === true;
  if (!sslEnabled) {
    return false;
  }

  return {
    rejectUnauthorized: getBooleanEnv('DB_SSL_REJECT_UNAUTHORIZED') !== false,
  };
}

async function upsertMenu(client, menu) {
  const existing = await client.query(
    `
    SELECT "id"
    FROM "menus"
    WHERE "name" = $1
      AND "path" IS NOT DISTINCT FROM $2::text
      AND "parent_id" IS NOT DISTINCT FROM $3::uuid
    LIMIT 1
    `,
    [menu.name, menu.path, menu.parentId],
  );

  if (existing.rowCount > 0) {
    const existingId = existing.rows[0].id;
    await client.query(
      `
      UPDATE "menus"
      SET "icon" = $2,
          "sortOrder" = $3,
          "isActive" = $4,
          "updatedBy" = $5,
          "updatedAt" = NOW()
      WHERE "id" = $1
      `,
      [existingId, menu.icon, menu.sortOrder, menu.isActive, menu.updatedBy],
    );
    return existingId;
  }

  const inserted = await client.query(
    `
    INSERT INTO "menus" (
      "name", "path", "icon", "parent_id",
      "sortOrder", "isActive", "createdBy", "updatedBy"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8
    )
    RETURNING "id"
    `,
    [
      menu.name,
      menu.path,
      menu.icon,
      menu.parentId,
      menu.sortOrder,
      menu.isActive,
      menu.createdBy,
      menu.updatedBy,
    ],
  );

  return inserted.rows[0].id;
}

async function main() {
  const client = new Client({
    host: getRequiredEnv('DB_HOST'),
    port: getNumberEnv('DB_PORT'),
    user: getRequiredEnv('DB_USERNAME'),
    password: getRequiredEnv('DB_PASSWORD'),
    database: getRequiredEnv('DB_DATABASE'),
    ssl: getSslConfig(),
  });

  const companyId = '11111111-1111-4111-b111-111111111111';
  const systemUserId = '00000000-0000-0000-0000-000000000000';
  const adminUserId = '22222222-2222-2222-2222-222222222222';
  const adminEmail = process.argv[2] || process.env.SEED_ADMIN_EMAIL || 'admin@maraekat.com';
  const adminPassword = process.argv[3] || process.env.SEED_ADMIN_PASSWORD || 'password123';

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    console.log('Clearing entire database (truncating all tables)...');
    await client.query(`
      DO $$ DECLARE
          r RECORD;
      BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'migrations') LOOP
              EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
      END $$;
    `);
    console.log('Database cleared successfully.');

    console.log(`Hashing password for ${adminEmail}...`);
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    console.log('Onboarding company "Maraekat FX Pvt. Ltd."...');
    await client.query(
      `
      INSERT INTO "company" (
        "id", "shortCode", "companyName", "formerlyKnownName", "cinNo", "panNo",
        "fxRegNo", "fxRegDate", "fromDate", "toDate", "logo", "aeonLicNo",
        "website", "emailId", "createdBy", "updatedBy"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
      ON CONFLICT ("id") DO UPDATE SET
        "shortCode" = EXCLUDED."shortCode",
        "companyName" = EXCLUDED."companyName",
        "formerlyKnownName" = EXCLUDED."formerlyKnownName",
        "cinNo" = EXCLUDED."cinNo",
        "panNo" = EXCLUDED."panNo",
        "fxRegNo" = EXCLUDED."fxRegNo",
        "fxRegDate" = EXCLUDED."fxRegDate",
        "fromDate" = EXCLUDED."fromDate",
        "toDate" = EXCLUDED."toDate",
        "logo" = EXCLUDED."logo",
        "aeonLicNo" = EXCLUDED."aeonLicNo",
        "website" = EXCLUDED."website",
        "emailId" = EXCLUDED."emailId",
        "updatedBy" = EXCLUDED."updatedBy";
    `,
      [
        companyId,
        'MARAEKAT',
        'Maraekat FX Pvt. Ltd.'.toUpperCase(),
        'Formerly Known As Maraekat'.toUpperCase(),
        'U72200MH2000PTC123456',
        'AAACM1234A',
        'FX-REG-12345',
        new Date(),
        new Date(),
        new Date('2030-12-31'),
        null,
        'AEON-LIC-98765',
        'https://maraekat.com',
        'info@maraekat.com'.toUpperCase(),
        systemUserId,
        systemUserId,
      ],
    );
    console.log('Company onboarded successfully.');

    console.log(`Onboarding admin user "${adminEmail}"...`);
    await client.query('DELETE FROM "users" WHERE "emailId" = $1 OR "userCode" = $2;', [
      adminEmail,
      'ADM001',
    ]);

    await client.query(
      `
      INSERT INTO "users" (
        "id", "userCode", "password", "userName", "userGroupCode",
        "contactNo", "emailId", "employeeNo", "designation", "branchCode",
        "userLicNo", "isActive", "isLocked", "isDormant", "createdBy", "updatedBy"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      );
    `,
      [
        adminUserId,
        'ADM001',
        hashedPassword,
        'Sarthak Kumar'.toUpperCase(),
        'ADMIN',
        '9876543210',
        adminEmail.toUpperCase(),
        'EMP001',
        'Administrator'.toUpperCase(),
        null,
        'LIC001',
        true,
        false,
        false,
        systemUserId,
        systemUserId,
      ],
    );
    console.log('Admin user onboarded successfully.');

    console.log('Onboarding menu tree...');
    const masterMenuId = await upsertMenu(client, {
      name: 'Master',
      path: null,
      icon: 'grid',
      parentId: null,
      sortOrder: 1,
      isActive: true,
      createdBy: systemUserId,
      updatedBy: systemUserId,
    });

    const systemSetupMenuId = await upsertMenu(client, {
      name: 'System Setup',
      path: null,
      icon: 'settings',
      parentId: masterMenuId,
      sortOrder: 1,
      isActive: true,
      createdBy: systemUserId,
      updatedBy: systemUserId,
    });
    await upsertMenu(client, {
      name: 'Roles Profile',
      path: '/master/system-setups/user-role',
      icon: 'shield',
      parentId: systemSetupMenuId,
      sortOrder: 1,
      isActive: true,
      createdBy: systemUserId,
      updatedBy: systemUserId,
    });

    await upsertMenu(client, {
      name: 'User Profile',
      path: '/master/system-setups/user-profile',
      icon: 'users',
      parentId: systemSetupMenuId,
      sortOrder: 2,
      isActive: true,
      createdBy: systemUserId,
      updatedBy: systemUserId,
    });

    await upsertMenu(client, {
      name: 'Product Profile',
      path: '/master/system-setups/product-profile',
      icon: 'archive',
      parentId: systemSetupMenuId,
      sortOrder: 3,
      isActive: true,
      createdBy: systemUserId,
      updatedBy: systemUserId,
    });

    await upsertMenu(client, {
      name: 'Country Profile',
      path: '/master/system-setups/country-profile',
      icon: 'globe',
      parentId: systemSetupMenuId,
      sortOrder: 4,
      isActive: true,
      createdBy: systemUserId,
      updatedBy: systemUserId,
    });

    await upsertMenu(client, {
      name: 'State Profile',
      path: '/master/system-setups/state-profile',
      icon: 'map',
      parentId: systemSetupMenuId,
      sortOrder: 5,
      isActive: true,
      createdBy: systemUserId,
      updatedBy: systemUserId,
    });
    console.log('Menu tree onboarded successfully.');

    console.log('Onboarding permissions...');
    const requiredPermissions = [
      { code: 'add', name: 'Add', description: 'Permission to add records' },
      { code: 'modify', name: 'Modify', description: 'Permission to modify records' },
      { code: 'delete', name: 'Delete', description: 'Permission to delete records' },
      { code: 'view', name: 'View', description: 'Permission to view records' },
      { code: 'export', name: 'Export', description: 'Permission to export data' },
      { code: 'authorized', name: 'Authorized', description: 'Permission to authorize records' },
      { code: 'rejected', name: 'Rejected', description: 'Permission to reject records' },
    ];

    const permissionIds = [];
    for (const p of requiredPermissions) {
      const existing = await client.query(
        'SELECT "id" FROM "permissions" WHERE "code" = $1 LIMIT 1;',
        [p.code]
      );
      let permId;
      if (existing.rowCount > 0) {
        permId = existing.rows[0].id;
      } else {
        const inserted = await client.query(
          `
          INSERT INTO "permissions" (
            "code", "name", "description", "createdBy", "updatedBy"
          ) VALUES (
            $1, $2, $3, $4, $5
          ) RETURNING "id"
          `,
          [p.code, p.name, p.description, systemUserId, systemUserId]
        );
        permId = inserted.rows[0].id;
      }
      permissionIds.push(permId);
    }
    console.log('Permissions onboarded successfully.');

    console.log('Onboarding Admin role...');
    const adminRoleCode = 'ADMIN';
    const adminRoleName = 'ADMIN';
    const adminRoleId = '33333333-3333-3333-3333-333333333333';

    await client.query('DELETE FROM "roles" WHERE "userGroupCode" = $1 OR "id" = $2;', [
      adminRoleCode,
      adminRoleId
    ]);

    await client.query(
      `
      INSERT INTO "roles" (
        "id", "userGroupCode", "userGroupName", "isAdminGrp", "isActive", "createdBy", "updatedBy"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7
      )
      `,
      [adminRoleId, adminRoleCode, adminRoleName, true, true, systemUserId, systemUserId]
    );
    console.log('Admin role onboarded successfully.');

    console.log('Granting all permissions to Admin role...');
    // Clean up existing permissions for this role first
    await client.query('DELETE FROM "roles_menu_permissions" WHERE "role_id" = $1;', [adminRoleId]);

    // Get all menus
    const allMenus = await client.query('SELECT "id" FROM "menus";');
    for (const menuRow of allMenus.rows) {
      for (const permId of permissionIds) {
        await client.query(
          `
          INSERT INTO "roles_menu_permissions" (
            "role_id", "company_id", "menu_id", "permission_id"
          ) VALUES (
            $1, $2, $3, $4
          ) ON CONFLICT DO NOTHING;
          `,
          [adminRoleId, companyId, menuRow.id, permId]
        );
      }
    }
    console.log('Permissions granted successfully.');

    console.log('Assigning Admin role to admin user...');
    await client.query('DELETE FROM "user_roles" WHERE "user_id" = $1;', [adminUserId]);
    await client.query(
      `
      INSERT INTO "user_roles" (
        "user_id", "role_id", "branch_id", "counter_id"
      ) VALUES (
        $1, $2, NULL, NULL
      );
      `,
      [adminUserId, adminRoleId]
    );
    console.log('Admin role assigned successfully.');

    console.log('\n--- Login Credentials ---');
    console.log(`Email:    ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log('-------------------------\n');
  } catch (err) {
    console.error('Error during onboarding seed:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
