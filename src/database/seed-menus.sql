-- Seed script for the menus table
-- Menu hierarchy:
--   Admin (root)
--     ├─ Company Profile
--     ├─ Branch Profile
--     ├─ Counter Profile
--     ├─ Category Options
--     └─ Menu Management
--
--   Master (root)
--     └─ System Setup
--         ├─ Company Profile
--         ├─ Branch Profile
--         ├─ Roles Profile
--         └─ User Profile
--
-- Note: The BaseEntity requires createdBy/updatedBy UUIDs.
-- Using a placeholder system UUID. Replace with an actual admin user UUID if needed.

DO $$
DECLARE
  v_system_user UUID := '00000000-0000-0000-0000-000000000000';
  v_admin_id UUID;
  v_master_id UUID;
  v_system_setup_id UUID;
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
  VALUES (uuid_generate_v4(), false, 'Category Options', '/admin/category-options', 'tags', v_admin_id, 4, true, v_system_user, v_system_user);

  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Menu Management', '/admin/menu-management', 'menu', v_admin_id, 5, true, v_system_user, v_system_user);

  -- Insert "Master" root menu
  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'Master', NULL, 'grid', NULL, 1, true, v_system_user, v_system_user)
  RETURNING id INTO v_master_id;

  -- Insert "System Setup" under Master
  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'System Setup', NULL, 'settings', v_master_id, 1, true, v_system_user, v_system_user)
  RETURNING id INTO v_system_setup_id;

  -- Insert "Roles Profile" under System Setup
  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'User Role', '/admin/user-role', 'shield', v_system_setup_id, 1, true, v_system_user, v_system_user);

  -- Insert "User Profile" under System Setup
  INSERT INTO menus (id, is_admin, name, path, icon, parent_id, sort_order, is_active, created_by, updated_by)
  VALUES (uuid_generate_v4(), false, 'User Profile', '/admin/user-profile', 'users', v_system_setup_id, 2, true, v_system_user, v_system_user);

  RAISE NOTICE 'Menu seed completed. Master ID: %, System Setup ID: %', v_master_id, v_system_setup_id;
END $$;
