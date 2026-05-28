-- Seed script for the menus table
-- Menu hierarchy:
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
  v_master_id UUID;
  v_system_setup_id UUID;
BEGIN
  -- Insert "Master" root menu
  INSERT INTO menus (id, name, path, icon, parent_id, "sortOrder", "isActive", "createdBy", "updatedBy")
  VALUES (gen_random_uuid(), 'Master', NULL, 'grid', NULL, 1, true, v_system_user, v_system_user)
  RETURNING id INTO v_master_id;

  -- Insert "System Setup" under Master
  INSERT INTO menus (id, name, path, icon, parent_id, "sortOrder", "isActive", "createdBy", "updatedBy")
  VALUES (gen_random_uuid(), 'System Setup', NULL, 'settings', v_master_id, 1, true, v_system_user, v_system_user)
  RETURNING id INTO v_system_setup_id;

  -- Insert "Company Profile" under System Setup
  INSERT INTO menus (id, name, path, icon, parent_id, "sortOrder", "isActive", "createdBy", "updatedBy")
  VALUES (gen_random_uuid(), 'Company Profile', '/master/system-setups/company-profile', 'building', v_system_setup_id, 1, true, v_system_user, v_system_user);

  -- Insert "Branch Profile" under System Setup
  INSERT INTO menus (id, name, path, icon, parent_id, "sortOrder", "isActive", "createdBy", "updatedBy")
  VALUES (gen_random_uuid(), 'Branch Profile', '/master/system-setups/branch-profile', 'map-pin', v_system_setup_id, 2, true, v_system_user, v_system_user);

  -- Insert "Roles Profile" under System Setup
  INSERT INTO menus (id, name, path, icon, parent_id, "sortOrder", "isActive", "createdBy", "updatedBy")
  VALUES (gen_random_uuid(), 'Roles Profile', '/master/system-setups/roles-profile', 'shield', v_system_setup_id, 3, true, v_system_user, v_system_user);

  -- Insert "User Profile" under System Setup
  INSERT INTO menus (id, name, path, icon, parent_id, "sortOrder", "isActive", "createdBy", "updatedBy")
  VALUES (gen_random_uuid(), 'User Profile', '/master/system-setups/user-profile', 'users', v_system_setup_id, 4, true, v_system_user, v_system_user);

  RAISE NOTICE 'Menu seed completed. Master ID: %, System Setup ID: %', v_master_id, v_system_setup_id;
END $$;
