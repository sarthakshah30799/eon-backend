require("dotenv").config();

const { Client } = require("pg");
const bcrypt = require("bcrypt");

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
  return value.toLowerCase() === "true";
}

function getSslConfig() {
  const sslEnabled = getBooleanEnv("DB_SSL") === true;
  if (!sslEnabled) {
    return false;
  }

  return {
    rejectUnauthorized: getBooleanEnv("DB_SSL_REJECT_UNAUTHORIZED") !== false,
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
          "updated_at" = NOW(),
          "is_admin" = $6
      WHERE "id" = $1
      `,
      [
        existingId,
        menu.icon,
        menu.sortOrder,
        menu.isActive,
        menu.updatedBy,
        menu.isAdmin ?? false,
      ],
    );
    return existingId;
  }

  const inserted = await client.query(
    `
    INSERT INTO "menus" (
      "name", "path", "icon", "parent_id",
      "sort_order", "is_active", "created_by", "updated_by", "is_admin"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9
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
      menu.isAdmin ?? false,
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
      SET "code" = $1,
          "password" = $2,
          "name" = $3,
          "contact_no" = $4,
          "email" = $5,
          "employee_no" = $6,
          "designation" = $7,
          "user_lic_no" = $8,
          "is_active" = $9,
          "is_locked" = $10,
          "is_dormant" = $11,
          "is_admin" = $12,
          "updated_by" = $13,
          "updated_at" = NOW()
      WHERE "id" = $14
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
        user.isAdmin ?? false,
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
      "user_lic_no", "is_active", "is_locked", "is_dormant", "is_admin",
      "created_by", "updated_by"
    ) VALUES (
      $1, $2, $3,
      $4, $5, $6, $7,
      $8, $9, $10, $11, $12,
      $13, $14
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
      user.isAdmin ?? false,
      user.createdBy,
      user.updatedBy,
    ],
  );

  return inserted.rows[0].id;
}

async function upsertCategoryOption(client, option) {
  const existing = await client.query(
    `
    SELECT "id"
    FROM "category_options"
    WHERE "code" = $1 AND "value" = $2
    LIMIT 1
    `,
    [option.code, option.value],
  );

  if (existing.rowCount > 0) {
    const existingId = existing.rows[0].id;
    await client.query(
      `
      UPDATE "category_options"
      SET "label" = $2,
          "sort_order" = $3,
          "is_active" = $4,
          "updated_by" = $5,
          "updated_at" = NOW()
      WHERE "id" = $1
      `,
      [
        existingId,
        option.label,
        option.sortOrder,
        option.isActive,
        option.updatedBy,
      ],
    );
    return existingId;
  }

  const inserted = await client.query(
    `
    INSERT INTO "category_options" (
      "code", "value", "label",
      "sort_order", "is_active", "created_by", "updated_by"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7
    )
    RETURNING "id"
    `,
    [
      option.code,
      option.value,
      option.label,
      option.sortOrder,
      option.isActive,
      option.createdBy,
      option.updatedBy,
    ],
  );

  return inserted.rows[0].id;
}

async function upsertFinancialCode(client, fc) {
  const existing = await client.query(
    `
    SELECT "id"
    FROM "financial_codes"
    WHERE "financial_code" = $1
    LIMIT 1
    `,
    [fc.financialCode],
  );

  if (existing.rowCount > 0) {
    const existingId = existing.rows[0].id;
    await client.query(
      `
      UPDATE "financial_codes"
      SET "financial_type" = $2,
          "financial_name" = $3,
          "default_sign" = $4,
          "priority" = $5,
          "updated_by" = $6,
          "updated_at" = NOW()
      WHERE "id" = $1
      `,
      [
        existingId,
        fc.financialType,
        fc.financialName,
        fc.defaultSign,
        fc.priority,
        fc.updatedBy,
      ],
    );
    return existingId;
  }

  const inserted = await client.query(
    `
    INSERT INTO "financial_codes" (
      "financial_type", "financial_code", "financial_name", "default_sign",
      "priority", "created_by", "updated_by"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7
    )
    RETURNING "id"
    `,
    [
      fc.financialType,
      fc.financialCode,
      fc.financialName,
      fc.defaultSign,
      fc.priority,
      fc.createdBy,
      fc.updatedBy,
    ],
  );

  return inserted.rows[0].id;
}

async function upsertFinancialSubProfile(client, fsp) {
  const existing = await client.query(
    `
    SELECT "id"
    FROM "financial_sub_profiles"
    WHERE "financial_code_id" = $1 AND "financial_sub_code" = $2
    LIMIT 1
    `,
    [fsp.financialCodeId, fsp.financialSubCode],
  );

  if (existing.rowCount > 0) {
    const existingId = existing.rows[0].id;
    await client.query(
      `
      UPDATE "financial_sub_profiles"
      SET "financial_sub_name" = $2,
          "priority" = $3,
          "updated_by" = $4,
          "updated_at" = NOW()
      WHERE "id" = $1
      `,
      [existingId, fsp.financialSubName, fsp.priority, fsp.updatedBy],
    );
    return existingId;
  }

  const inserted = await client.query(
    `
    INSERT INTO "financial_sub_profiles" (
      "financial_code_id", "financial_sub_code", "financial_sub_name",
      "priority", "created_by", "updated_by"
    ) VALUES (
      $1, $2, $3, $4, $5, $6
    )
    RETURNING "id"
    `,
    [
      fsp.financialCodeId,
      fsp.financialSubCode,
      fsp.financialSubName,
      fsp.priority,
      fsp.createdBy,
      fsp.updatedBy,
    ],
  );

  return inserted.rows[0].id;
}

async function upsertCountryGroup(client, group) {
  const existing = await client.query(
    `
    SELECT "id"
    FROM "country_groups"
    WHERE "code" = $1
    LIMIT 1
    `,
    [group.code],
  );

  if (existing.rowCount > 0) {
    const existingId = existing.rows[0].id;
    await client.query(
      `
      UPDATE "country_groups"
      SET "name" = $2,
          "updated_by" = $3,
          "updated_at" = NOW()
      WHERE "id" = $1
      `,
      [existingId, group.name, group.updatedBy],
    );
    return existingId;
  }

  const inserted = await client.query(
    `
    INSERT INTO "country_groups" (
      "name", "code", "created_by", "updated_by"
    ) VALUES (
      $1, $2, $3, $4
    )
    RETURNING "id"
    `,
    [group.name, group.code, group.createdBy, group.updatedBy],
  );

  return inserted.rows[0].id;
}

async function main() {
  const client = new Client({
    host: getRequiredEnv("DB_HOST"),
    port: getNumberEnv("DB_PORT"),
    user: getRequiredEnv("DB_USERNAME"),
    password: getRequiredEnv("DB_PASSWORD"),
    database: getRequiredEnv("DB_DATABASE"),
    ssl: getSslConfig(),
  });

  const systemUserId = "00000000-0000-0000-0000-000000000000";
  const adminEmail =
    process.argv[2] || process.env.SEED_ADMIN_EMAIL || "admin@maraekat.com";
  const adminPassword =
    process.argv[3] || process.env.SEED_ADMIN_PASSWORD || "password123";

  try {
    await client.connect();
    console.log("Connected to PostgreSQL successfully.");

    console.log(`Hashing password for ${adminEmail}...`);
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    console.log("Onboarding basic menu tree...");
    const masterMenuId = await upsertMenu(client, {
      name: "Master",
      path: null,
      icon: "grid",
      parentId: null,
      sortOrder: 1,
      isActive: true,
      createdBy: systemUserId,
      updatedBy: systemUserId,
      isAdmin: false,
    });

    const systemSetupMenuId = await upsertMenu(client, {
      name: "System Setup",
      path: null,
      icon: "settings",
      parentId: masterMenuId,
      sortOrder: 1,
      isActive: true,
      createdBy: systemUserId,
      updatedBy: systemUserId,
      isAdmin: false,
    });

    const basicMenus = [
      { name: "User Role", path: "/admin/user-role", icon: "shield" },
      { name: "User Profile", path: "/admin/user-profile", icon: "users" },
      {
        name: "Country Profile",
        path: "/admin/country-profile",
        icon: "globe",
      },
      { name: "State Profile", path: "/admin/state-profile", icon: "map" },
      {
        name: "Product Profile",
        path: "/admin/product-profile",
        icon: "archive",
      },
      {
        name: "Currency Profile",
        path: "/admin/currency-profile",
        icon: "dollar-sign",
      },
      { name: "TDS Profile", path: "/admin/tds-profile", icon: "receipt" },
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
        isAdmin: false,
      });
    }

    const adminMenuId = await upsertMenu(client, {
      name: "Admin",
      path: null,
      icon: "shield",
      parentId: null,
      sortOrder: 0,
      isActive: true,
      createdBy: systemUserId,
      updatedBy: systemUserId,
      isAdmin: true,
    });

    const adminSubMenus = [
      {
        name: "Company Profile",
        path: "/admin/company-profile",
        icon: "building",
      },
      {
        name: "Branch Profile",
        path: "/admin/branch-profile",
        icon: "sitemap",
      },
      {
        name: "Counter Profile",
        path: "/admin/counter-profile",
        icon: "counter",
      },
      {
        name: "Category Options",
        path: "/admin/category-options",
        icon: "tags",
      },
      { name: "Menu Management", path: "/admin/menu-management", icon: "menu" },
      {
        name: "Financial Profile",
        path: "/admin/financial-profile",
        icon: "dollar-sign",
      },
      {
        name: "Accounts Profile",
        path: "/admin/accounts-profile",
        icon: "book",
      },
      {
        name: "Additional Settings",
        path: "/admin/additional-settings",
        icon: "settings",
      },
      {
        name: "Corporate Client Profile",
        path: "/admin/corporate-client-profile",
        icon: "users",
      },
    ];

    for (let index = 0; index < adminSubMenus.length; index += 1) {
      const menu = adminSubMenus[index];
      await upsertMenu(client, {
        name: menu.name,
        path: menu.path,
        icon: menu.icon,
        parentId: adminMenuId,
        sortOrder: index + 1,
        isActive: true,
        createdBy: systemUserId,
        updatedBy: systemUserId,
        isAdmin: true,
      });
    }
    console.log("Menu tree onboarded successfully.");

    console.log(`Onboarding admin user "${adminEmail}"...`);
    const adminUserDbId = await upsertUser(client, {
      code: "ADM001",
      password: hashedPassword,
      name: "Admin",
      contactNo: "9876543210",
      email: adminEmail.toLowerCase(),
      employeeNo: "EMP001",
      designation: "Administrator",
      userLicNo: "LIC001",
      isActive: true,
      isLocked: false,
      isDormant: false,
      isAdmin: true,
      createdBy: systemUserId,
      updatedBy: systemUserId,
    });
    console.log("Admin user onboarded successfully.");
    await client.query('DELETE FROM "user_roles" WHERE "user_id" = $1;', [
      adminUserDbId,
    ]);
    console.log("Cleared legacy role assignments for admin user.");

    console.log("Onboarding default category options...");
    const defaultOptions = [
      {
        code: "financialType",
        value: "PROFIT & LOSS",
        label: "PROFIT & LOSS",
        sortOrder: 1,
      },
      {
        code: "financialType",
        value: "TRADING",
        label: "TRADING",
        sortOrder: 2,
      },
      {
        code: "financialType",
        value: "BALANCE SHEET",
        label: "BALANCE SHEET",
        sortOrder: 3,
      },
      { code: "defaultSign", value: "DEBIT", label: "DEBIT", sortOrder: 1 },
      { code: "defaultSign", value: "CREDIT", label: "CREDIT", sortOrder: 2 },
      {
        code: "divisionDept",
        value: "HEAD OFFICE",
        label: "HEAD OFFICE",
        sortOrder: 1,
      },
      {
        code: "divisionDept",
        value: "FINANCE DEPT",
        label: "FINANCE DEPT",
        sortOrder: 2,
      },
      {
        code: "divisionDept",
        value: "OPERATIONS DEPT",
        label: "OPERATIONS DEPT",
        sortOrder: 3,
      },
      {
        code: "accountType",
        value: "GENERAL LEDGER",
        label: "GENERAL LEDGER",
        sortOrder: 1,
      },
      {
        code: "accountType",
        value: "CUSTOMER LEDGER",
        label: "CUSTOMER LEDGER",
        sortOrder: 2,
      },
      {
        code: "accountType",
        value: "SUPPLIER LEDGER",
        label: "SUPPLIER LEDGER",
        sortOrder: 3,
      },
      {
        code: "accountType",
        value: "BANK LEDGER",
        label: "BANK LEDGER",
        sortOrder: 4,
      },
      {
        code: "subLedger",
        value: "DIRECT LEDGER",
        label: "DIRECT LEDGER",
        sortOrder: 1,
      },
      {
        code: "subLedger",
        value: "INDIRECT LEDGER",
        label: "INDIRECT LEDGER",
        sortOrder: 2,
      },
      { code: "subLedger", value: "NONE", label: "NONE", sortOrder: 3 },
      {
        code: "bankNature",
        value: "SAVINGS A/C",
        label: "SAVINGS A/C",
        sortOrder: 1,
      },
      {
        code: "bankNature",
        value: "CURRENT A/C",
        label: "CURRENT A/C",
        sortOrder: 2,
      },
      {
        code: "bankNature",
        value: "OVERDRAFT A/C",
        label: "OVERDRAFT A/C",
        sortOrder: 3,
      },
      { code: "bankNature", value: "NONE", label: "NONE", sortOrder: 4 },
      // KYC Risk Category
      {
        code: "kycRiskCategory",
        value: "LOW RISK CATEGORY",
        label: "LOW RISK CATEGORY",
        sortOrder: 1,
      },
      {
        code: "kycRiskCategory",
        value: "MEDIUM RISK CATEGORY",
        label: "MEDIUM RISK CATEGORY",
        sortOrder: 2,
      },
      {
        code: "kycRiskCategory",
        value: "HIGH RISK CATEGORY",
        label: "HIGH RISK CATEGORY",
        sortOrder: 3,
      },
      // Entity Type
      { code: "entityType", value: "COMPANY", label: "COMPANY", sortOrder: 1 },
      {
        code: "entityType",
        value: "INDIVIDUAL",
        label: "INDIVIDUAL",
        sortOrder: 2,
      },
      {
        code: "entityType",
        value: "PARTNERSHIP",
        label: "PARTNERSHIP",
        sortOrder: 3,
      },
      {
        code: "entityType",
        value: "PROPRIETORSHIP",
        label: "PROPRIETORSHIP",
        sortOrder: 4,
      },
      // Default Agent, Group, Marketing Executive, Business Nature, Location
      { code: "defaultAgent", value: "NONE", label: "NONE", sortOrder: 1 },
      { code: "group", value: "NONE", label: "NONE", sortOrder: 1 },
      {
        code: "marketingExecutive",
        value: "NONE",
        label: "NONE",
        sortOrder: 1,
      },
      { code: "businessNature", value: "NONE", label: "NONE", sortOrder: 1 },
      { code: "locationType", value: "NONE", label: "NONE", sortOrder: 1 },
      // TDS Group
      { code: "tdsGroup", value: "NONE", label: "NONE", sortOrder: 1 },
      { code: "tdsGroup", value: "A", label: "A", sortOrder: 2 },
      { code: "tdsGroup", value: "B", label: "B", sortOrder: 3 },
    ];
    for (const opt of defaultOptions) {
      await upsertCategoryOption(client, {
        ...opt,
        isActive: true,
        createdBy: systemUserId,
        updatedBy: systemUserId,
      });
    }

    console.log("Onboarding default financial codes...");
    const bankBlId = await upsertFinancialCode(client, {
      financialType: "PROFIT & LOSS",
      financialCode: "BANKBL",
      financialName: "BANK BALANCES",
      defaultSign: "DEBIT",
      priority: 1,
      createdBy: systemUserId,
      updatedBy: systemUserId,
    });

    const opStokId = await upsertFinancialCode(client, {
      financialType: "TRADING",
      financialCode: "OPSTOK",
      financialName: "OPENING STOCK",
      defaultSign: "DEBIT",
      priority: 2,
      createdBy: systemUserId,
      updatedBy: systemUserId,
    });

    console.log("Onboarding default financial sub profiles...");
    await upsertFinancialSubProfile(client, {
      financialCodeId: bankBlId,
      financialSubCode: "HDFCA",
      financialSubName: "HDFC CURRENT A/C",
      priority: 1,
      createdBy: systemUserId,
      updatedBy: systemUserId,
    });
    await upsertFinancialSubProfile(client, {
      financialCodeId: opStokId,
      financialSubCode: "OPSTK_GEN",
      financialSubName: "GENERAL OPENING STOCK",
      priority: 1,
      createdBy: systemUserId,
      updatedBy: systemUserId,
    });

    console.log("Onboarding default country groups...");
    const defaultCountryGroups = [
      { name: "EUROPE", code: "EUROPE" },
      { name: "NORTH AMERICA", code: "NORTH_AMERICA" },
      { name: "GULF COUNTRIES", code: "GULF_COUNTRIES" },
      { name: "MIDDLE EAST", code: "MIDDLE_EAST" },
    ];
    for (const group of defaultCountryGroups) {
      await upsertCountryGroup(client, {
        ...group,
        createdBy: systemUserId,
        updatedBy: systemUserId,
      });
    }

    console.log("\n--- Login Credentials ---");
    console.log(`Email:    ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log("-------------------------\n");
  } catch (err) {
    console.error("Error during onboarding seed:", err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
