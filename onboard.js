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
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'sarthak.kumar@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'password123';

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    console.log(`Hashing password for ${adminEmail}...`);
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    console.log('Onboarding company "Maraekat FX Pvt. Ltd."...');
    await client.query(
      `
      INSERT INTO "company" (
        "id", "name", "designation", "rbiName", "rbiPlace",
        "address1", "address2", "address3", "pincode",
        "city", "state", "country", "createdBy", "updatedBy"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      ON CONFLICT ("id") DO UPDATE SET
        "name" = EXCLUDED."name",
        "designation" = EXCLUDED."designation",
        "rbiName" = EXCLUDED."rbiName",
        "rbiPlace" = EXCLUDED."rbiPlace",
        "address1" = EXCLUDED."address1",
        "address2" = EXCLUDED."address2",
        "address3" = EXCLUDED."address3",
        "pincode" = EXCLUDED."pincode",
        "city" = EXCLUDED."city",
        "state" = EXCLUDED."state",
        "country" = EXCLUDED."country",
        "updatedBy" = EXCLUDED."updatedBy"
    `,
      [
        companyId,
        'Maraekat FX Pvt. Ltd.',
        'Regional Compliance Officer',
        'RBI Main Office',
        'Mumbai',
        '12 Business Tower',
        'Nariman Point',
        'Mumbai, Maharashtra',
        '400021',
        'Mumbai',
        'Maharashtra',
        'India',
        systemUserId,
        systemUserId,
      ],
    );
    console.log('Company onboarded successfully.');

    console.log(`Onboarding admin user "${adminEmail}"...`);
    await client.query('DELETE FROM "users" WHERE "email" = $1 OR "userCode" = $2;', [
      adminEmail,
      'ADM001',
    ]);

    await client.query(
      `
      INSERT INTO "users" (
        "id", "userCode", "password", "firstName", "lastName",
        "email", "countryCode", "phoneNumber", "status", "isHo",
        "createdBy", "updatedBy"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      );
    `,
      [
        adminUserId,
        'ADM001',
        hashedPassword,
        'Sarthak',
        'Kumar',
        adminEmail,
        'IN',
        '9876543210',
        'active',
        true,
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
      name: 'Company Profile',
      path: '/master/system-setups/company-profile',
      icon: 'building',
      parentId: systemSetupMenuId,
      sortOrder: 1,
      isActive: true,
      createdBy: systemUserId,
      updatedBy: systemUserId,
    });

    await upsertMenu(client, {
      name: 'Branch Profile',
      path: '/master/system-setups/branch-profile',
      icon: 'map-pin',
      parentId: systemSetupMenuId,
      sortOrder: 2,
      isActive: true,
      createdBy: systemUserId,
      updatedBy: systemUserId,
    });

    await upsertMenu(client, {
      name: 'Roles Profile',
      path: '/master/system-setups/user-role',
      icon: 'shield',
      parentId: systemSetupMenuId,
      sortOrder: 3,
      isActive: true,
      createdBy: systemUserId,
      updatedBy: systemUserId,
    });

    await upsertMenu(client, {
      name: 'User Profile',
      path: '/master/system-setups/user-profile',
      icon: 'users',
      parentId: systemSetupMenuId,
      sortOrder: 4,
      isActive: true,
      createdBy: systemUserId,
      updatedBy: systemUserId,
    });
    console.log('Menu tree onboarded successfully.');

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
