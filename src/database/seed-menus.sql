-- Seed script for the menus table
-- Menu hierarchy:
--   Admin (root)
--     ├─ Company Profile
--     ├─ Branch Profile
--     ├─ Counter Profile
--     ├─ Document Profile
--     ├─ Miscellaneous Profile
--     ├─ Product Profile
--     ├─ Country Profile
--     ├─ State Profile
--     ├─ Accounts Profile
--     ├─ User Role
--     ├─ TDS Profile
--     ├─ Menu Management
--     └─ Additional Settings
--
--   Party Profiles (root)
--     ├─ Corporate Client Profile
--     ├─ FFMC Profile
--     ├─ RF Profile
--     ├─ Authorised Dealer Profile
--     ├─ RMC Profile
--     ├─ Franchise Profile
--     ├─ Agent Profile
--     ├─ Foreign Correspondent Profile
--     ├─ Marketing Executive Profile
--     ├─ Card Issuer Profile
--     └─ Misc Profile
--
--   Standalone root menus
--     ├─ User Profile
--     ├─ Financial Profile
--     ├─ Currency Profile
--     ├─ Expense Booking Master
--     └─ Income Booking Master
--
-- Note: The BaseEntity requires createdBy/updatedBy UUIDs.
-- Using a placeholder system UUID. Replace with an actual admin user UUID if needed.

DO $$
DECLARE
  v_system_user UUID := '00000000-0000-0000-0000-000000000000';
  v_admin_id UUID;
  v_party_profiles_id UUID;
BEGIN
  -- Insert "Admin" root menu
  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), true, 'Admin', NULL, 'shield', NULL, 0, true, v_system_user, v_system_user)
  RETURNING id INTO v_admin_id;

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Company Profile', '/admin/company-profile', 'building', v_admin_id, 1, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Branch Profile', '/admin/branch-profile', 'sitemap', v_admin_id, 2, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Counter Profile', '/admin/counter-profile', 'counter', v_admin_id, 3, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Document Profile', '/admin/document-profile', 'file-text', v_admin_id, 4, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Miscellaneous Profile', '/admin/miscellaneous-profile', 'layout-grid', v_admin_id, 5, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Product Profile', '/admin/product-profile', 'archive', v_admin_id, 6, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Country Profile', '/admin/country-profile', 'globe', v_admin_id, 7, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'State Profile', '/admin/state-profile', 'map', v_admin_id, 8, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Accounts Profile', '/admin/accounts-profile', 'book', v_admin_id, 9, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'User Role', '/admin/user-role', 'shield', v_admin_id, 10, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Tds Profile', '/admin/tds-profile', 'receipt', v_admin_id, 11, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Menu Management', '/admin/menu-management', 'menu', v_admin_id, 12, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Additional Settings', '/admin/additional-settings', 'settings', v_admin_id, 13, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Manual Bill Books', '/manual-bill-books', 'book-open', v_admin_id, 14, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Chequebooks', '/admin/chequebooks', 'book-open', v_admin_id, 15, true, v_system_user, v_system_user);

  -- Insert "Party Profiles" root menu
  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Party Profiles', NULL, 'users', NULL, 1, true, v_system_user, v_system_user)
  RETURNING id INTO v_party_profiles_id;

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Corporate Client Profile', '/party-profiles/corporate-client', 'users', v_party_profiles_id, 1, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Ffmc Profile', '/party-profiles/ffmc', 'badge-check', v_party_profiles_id, 2, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Rf Profile', '/party-profiles/rf', 'badge-check', v_party_profiles_id, 3, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Authorised Dealer Profile', '/party-profiles/authorised-dealer', 'badge-check', v_party_profiles_id, 4, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Rmc Profile', '/party-profiles/rmc', 'badge-check', v_party_profiles_id, 5, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Franchise Profile', '/party-profiles/franchise', 'badge-check', v_party_profiles_id, 6, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Agent Profile', '/party-profiles/agent', 'badge-check', v_party_profiles_id, 7, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Foreign Correspondent Profile', '/party-profiles/foreign-correspondent', 'badge-check', v_party_profiles_id, 8, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Forex Correspondent Profile', '/party-profiles/forex-correspondent', 'badge-check', v_party_profiles_id, 9, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Marketing Executive Profile', '/party-profiles/marketing-executive', 'badge-check', v_party_profiles_id, 10, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Card Issuer Profile', '/party-profiles/card-issuer-profile', 'badge-check', v_party_profiles_id, 11, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Misc Supplier Profile', '/party-profiles/misc-supplier-profile', 'badge-check', v_party_profiles_id, 12, true, v_system_user, v_system_user);

  -- Standalone menus
  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'User Profile', '/user-profile', 'users', NULL, 2, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Financial Profile', '/financial-profile', 'dollar-sign', NULL, 3, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Currency Profile', '/currency-profile', 'dollar-sign', NULL, 4, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Expense Booking Master', '/expense-booking', 'receipt', NULL, 5, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Income Booking Master', '/income-booking', 'credit-card', NULL, 6, true, v_system_user, v_system_user);

  RAISE NOTICE 'Menu seed completed. Admin ID: %, Party Profiles ID: %', v_admin_id, v_party_profiles_id;
END $$;
