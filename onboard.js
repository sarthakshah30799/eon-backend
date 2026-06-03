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
          "sort_order" = $3,
          "is_active" = $4,
          "updated_by" = $5,
          "updated_at" = NOW()
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
      "sort_order", "is_active", "created_by", "updated_by"
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

async function upsertRole(client, role) {
  const existing = await client.query(
    `
    SELECT "id"
    FROM "roles"
    WHERE "code" = $1
    LIMIT 1
    `,
    [role.code],
  );

  if (existing.rowCount > 0) {
    const existingId = existing.rows[0].id;
    await client.query(
      `
      UPDATE "roles"
      SET "name" = $2,
          "is_admin" = $3,
          "is_md" = $4,
          "is_compliance" = $5,
          "is_sr_finance" = $6,
          "is_finance" = $7,
          "is_brn_mgr" = $8,
          "is_executive" = $9,
          "is_card_stk" = $10,
          "is_delivery_boy" = $11,
          "is_cashier" = $12,
          "is_sales_mgr" = $13,
          "is_active" = $14,
          "is_aeon_access" = $15,
          "is_del_portal_access" = $16,
          "is_del_app_access" = $17,
          "updated_by" = $18,
          "updated_at" = NOW()
      WHERE "id" = $19
      `,
      [
        role.name,
        role.isAdmin,
        role.isMd,
        role.isCompliance,
        role.isSrFinance,
        role.isFinance,
        role.isBrnMgr,
        role.isExecutive,
        role.isCardStk,
        role.isDeliveryBoy,
        role.isCashier,
        role.isSalesMgr,
        role.isActive,
        role.isAeonAccess,
        role.isDelPortalAccess,
        role.isDelAppAccess,
        role.updatedBy,
        existingId,
      ],
    );
    return existingId;
  }

  const inserted = await client.query(
    `
    INSERT INTO "roles" (
      "code", "name", "is_admin", "is_md", "is_compliance",
      "is_sr_finance", "is_finance", "is_brn_mgr", "is_executive",
      "is_card_stk", "is_delivery_boy", "is_cashier", "is_sales_mgr",
      "is_active", "is_aeon_access", "is_del_portal_access", "is_del_app_access",
      "created_by", "updated_by"
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12, $13,
      $14, $15, $16, $17,
      $18, $19
    )
    RETURNING "id"
    `,
    [
      role.code,
      role.name,
      role.isAdmin,
      role.isMd,
      role.isCompliance,
      role.isSrFinance,
      role.isFinance,
      role.isBrnMgr,
      role.isExecutive,
      role.isCardStk,
      role.isDeliveryBoy,
      role.isCashier,
      role.isSalesMgr,
      role.isActive,
      role.isAeonAccess,
      role.isDelPortalAccess,
      role.isDelAppAccess,
      role.createdBy,
      role.updatedBy,
    ],
  );

  return inserted.rows[0].id;
}

async function upsertUser(client, user) {
  const existing = await client.query(
    `
    SELECT "id"
    FROM "users"
    WHERE "code" = $1 OR "email" = $2
    LIMIT 1
    `,
    [user.code, user.email],
  );

  if (existing.rowCount > 0) {
    const existingId = existing.rows[0].id;
    await client.query(
      `
      UPDATE "users"
      SET "code" = $2,
          "password" = $3,
          "name" = $4,
          "contact_no" = $5,
          "email" = $6,
          "employee_no" = $7,
          "designation" = $8,
          "user_lic_no" = $9,
          "is_active" = $10,
          "is_locked" = $11,
          "is_dormant" = $12,
          "updated_by" = $13,
          "updated_at" = NOW()
      WHERE "id" = $14
      `,
      [
        user.code,
        user.code,
        user.password,
        user.name,
        user.contactNo,
        user.email,
        user.employeeNo,
        user.designation,
        user.userLicNo,
        user.isActive,
        user.isLocked,
        user.isDormant,
        user.updatedBy,
        existingId,
      ],
    );
    return existingId;
  }

  const inserted = await client.query(
    `
    INSERT INTO "users" (
      "code", "password", "name",
      "contact_no", "email", "employee_no", "designation",
      "user_lic_no", "is_active", "is_locked", "is_dormant",
      "created_by", "updated_by"
    ) VALUES (
      $1, $2, $3,
      $4, $5, $6, $7,
      $8, $9, $10, $11,
      $12, $13
    )
    RETURNING "id"
    `,
    [
      user.code,
      user.password,
      user.name,
      user.contactNo,
      user.email,
      user.employeeNo,
      user.designation,
      user.userLicNo,
      user.isActive,
      user.isLocked,
      user.isDormant,
      user.createdBy,
      user.updatedBy,
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

  const systemUserId = '00000000-0000-0000-0000-000000000000';
  const adminEmail = process.argv[2] || process.env.SEED_ADMIN_EMAIL || 'admin@maraekat.com';
  const adminPassword = process.argv[3] || process.env.SEED_ADMIN_PASSWORD || 'password123';

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    console.log(`Hashing password for ${adminEmail}...`);
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    console.log('Onboarding basic menu tree...');
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

    const basicMenus = [
      { name: 'User Role', path: '/master/system-setups/user-role', icon: 'shield' },
      { name: 'User Profile', path: '/master/system-setups/user-profile', icon: 'users' },
      { name: 'Company Profile', path: '/master/system-setups/company-profile', icon: 'briefcase' },
      { name: 'Branch Profile', path: '/master/system-setups/branch-profile', icon: 'home' },
      { name: 'Counter Profile', path: '/master/system-setups/counter-profile', icon: 'monitor' },
      { name: 'Country Profile', path: '/master/system-setups/country-profile', icon: 'globe' },
      { name: 'State Profile', path: '/master/system-setups/state-profile', icon: 'map' },
      { name: 'Product Profile', path: '/master/system-setups/product-profile', icon: 'archive' },
    ];

    for (let index = 0; index < basicMenus.length; index += 1) {
      const menu = basicMenus[index];
      await upsertMenu(client, {
        name: menu.name,
        path: menu.path,
        icon: menu.icon,
        parentId: systemSetupMenuId,
        sortOrder: index + 1,
        isActive: true,
        createdBy: systemUserId,
        updatedBy: systemUserId,
      });
    }
    console.log('Menu tree onboarded successfully.');

    console.log('Onboarding Admin role...');
    const adminRoleId = await upsertRole(client, {
      code: 'ADMIN',
      name: 'Admin',
      isAdmin: true,
      isMd: false,
      isCompliance: false,
      isSrFinance: false,
      isFinance: false,
      isBrnMgr: false,
      isExecutive: false,
      isCardStk: false,
      isDeliveryBoy: false,
      isCashier: false,
      isSalesMgr: false,
      isActive: true,
      isAeonAccess: false,
      isDelPortalAccess: false,
      isDelAppAccess: false,
      createdBy: systemUserId,
      updatedBy: systemUserId,
    });
    console.log('Admin role onboarded successfully.');

    console.log(`Onboarding admin user "${adminEmail}"...`);
    const adminUserDbId = await upsertUser(client, {
      code: 'ADM001',
      password: hashedPassword,
      name: 'Admin',
      contactNo: '9876543210',
      email: adminEmail.toLowerCase(),
      employeeNo: 'EMP001',
      designation: 'Administrator',
      userLicNo: 'LIC001',
      isActive: true,
      isLocked: false,
      isDormant: false,
      createdBy: systemUserId,
      updatedBy: systemUserId,
    });
    console.log('Admin user onboarded successfully.');

    console.log('Assigning Admin role to admin user...');
    await client.query('DELETE FROM "user_roles" WHERE "user_id" = $1;', [adminUserDbId]);
    await client.query(
      `
      INSERT INTO "user_roles" (
        "user_id", "role_id", "branch_id", "counter_id"
      ) VALUES (
        $1, $2, NULL, NULL
      )
      ON CONFLICT DO NOTHING
      `,
      [adminUserDbId, adminRoleId],
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
