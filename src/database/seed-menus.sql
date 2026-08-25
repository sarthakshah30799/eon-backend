-- Upsert sidebar menus into the grouped tree.
-- Safe to re-run: matches existing rows by name/path, updates parent + sort_order,
-- inserts only when missing. Does not truncate, delete, or change menu ids/paths.
-- sort_order is always 0 so the UI orders each level A-Z by name.
--
-- Extra rows that are not in this spec (for example the empty Dashboard folder)
-- are left unchanged except sort_order is set to 0.

DO $$
DECLARE
  v_system_user UUID := '00000000-0000-0000-0000-000000000000';
  r RECORD;
  v_parent_id UUID;
  v_existing_id UUID;
  v_inserted INT := 0;
  v_updated INT := 0;
BEGIN
  DROP TABLE IF EXISTS menu_spec;
  CREATE TEMP TABLE menu_spec (
    ord INT NOT NULL,
    name TEXT NOT NULL,
    path TEXT,
    parent_name TEXT,
    parent_path TEXT,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    icon TEXT,
    match_role TEXT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO menu_spec (
    ord, name, path, parent_name, parent_path, is_admin, icon, match_role
  ) VALUES
  -- Root folders / groups
  (10,  'Admin',                  NULL,                              NULL, NULL,                              TRUE,  'shield',         'folder'),
  (20,  'Accounting',             NULL,                              NULL, NULL,                              FALSE, 'book',           'folder'),
  (30,  'CARD',                   NULL,                              NULL, NULL,                              FALSE, 'credit-card',    'folder'),
  (40,  'Operations',             NULL,                              NULL, NULL,                              FALSE, 'calendar-clock', 'folder'),
  (50,  'Other Transacations',    NULL,                              NULL, NULL,                              FALSE, 'receipt',        'folder'),
  (60,  'Party Profiles',         NULL,                              NULL, NULL,                              FALSE, 'users',          'folder'),
  (70,  'Purchase',               NULL,                              NULL, NULL,                              FALSE, 'shopping-cart',  'folder'),
  (80,  'Reports',                '/reports',                        NULL, NULL,                              FALSE, 'bar-chart',      'unique'),
  (90,  'Sells',                  NULL,                              NULL, NULL,                              FALSE, 'tag',            'folder'),
  (100, 'Transfer',               NULL,                              NULL, NULL,                              FALSE, 'arrow-left-right','folder'),

  -- Admin nested folders
  (110, 'Access',                 NULL, 'Admin', NULL, TRUE,  'users',       'folder'),
  (120, 'Configuration',          NULL, 'Admin', NULL, TRUE,  'settings',    'folder'),
  (130, 'Financial',              NULL, 'Admin', NULL, TRUE,  'book',        'folder'),
  (140, 'Geography',              NULL, 'Admin', NULL, TRUE,  'globe',       'folder'),
  (150, 'Organization',           NULL, 'Admin', NULL, TRUE,  'building',    'folder'),
  (160, 'Products & Rates',       NULL, 'Admin', NULL, TRUE,  'dollar-sign', 'folder'),

  -- Accounting
  (200, 'Journal Vouchers',       '/journal-vouchers',               'Accounting', NULL, FALSE, 'book-open', 'unique'),
  (210, 'Payments',               '/payments',                       'Accounting', NULL, FALSE, 'credit-card','unique'),
  (220, 'Receipts',               '/receipts',                       'Accounting', NULL, FALSE, 'receipt',   'unique'),

  -- CARD
  (300, 'Card Issuer Settlement', '/card-settlement',                'CARD', NULL, FALSE, 'credit-card', 'unique'),
  (310, 'Card Transfer',          '/card-transfer',                  'CARD', NULL, FALSE, 'arrow-left-right','unique'),
  (320, 'Receipt Stock',          '/card-stock',                     'CARD', NULL, FALSE, 'archive',     'unique'),

  -- Operations
  (400, 'Before/End Of Day',      '/day-end-start-process',          'Operations', NULL, FALSE, 'calendar-clock','unique'),
  (410, 'Cheque Books',           '/cheque-books',                   'Operations', NULL, FALSE, 'book-open', 'group'),
  (420, 'Manual Bill Book',       '/manual-bill-books',              'Operations', NULL, FALSE, 'book-open', 'group'),
  (430, 'Monthwise Locking',      '/admin/monthwise-locking',        'Operations', NULL, TRUE,  'lock',      'unique'),

  -- Cheque Books children
  (440, 'Cheque Books',           '/cheque-books',                   'Cheque Books',      '/cheque-books',      FALSE, 'book-open', 'leaf'),
  (450, 'Chequebook Mapping',     '/cheque-books/return',            'Cheque Books',      '/cheque-books',      FALSE, 'book-open', 'unique'),

  -- Manual Bill Book children
  (460, 'Manual Bill Book',       '/manual-bill-books',              'Manual Bill Book',  '/manual-bill-books', FALSE, 'book-open', 'leaf'),
  (470, 'Map to DP',              '/manual-bill-books/dp-mapping',   'Manual Bill Book',  '/manual-bill-books', FALSE, 'map',       'unique'),
  (480, 'Unmap to DP',            '/manual-bill-books/dp-unmapping', 'Manual Bill Book',  '/manual-bill-books', FALSE, 'map',       'unique'),

  -- Other Transacations
  (500, 'AD1 Transacations',      '/ad1',                            'Other Transacations', NULL, FALSE, 'receipt', 'unique'),
  (510, 'Fake Currencies',        '/fake-currencies',                'Other Transacations', NULL, FALSE, 'ban',     'unique'),

  -- Purchase
  (600, 'Purchase From Corporate/Individual', '/purchase/corporate-individual', 'Purchase', NULL, FALSE, 'shopping-cart', 'unique'),
  (610, 'Purchase From FFMC/ADs',             '/purchase/ffmc-ads',             'Purchase', NULL, FALSE, 'shopping-cart', 'unique'),
  (620, 'Purchase From Foreign',              '/purchase/foreign',              'Purchase', NULL, FALSE, 'shopping-cart', 'unique'),
  (630, 'Purchase From Forex',                '/purchase/forex',                'Purchase', NULL, FALSE, 'shopping-cart', 'unique'),
  (640, 'Purchase From Franchise',            '/purchase/franchise',            'Purchase', NULL, FALSE, 'shopping-cart', 'unique'),
  (650, 'Purchase From Misc',                 '/purchase/misc',                 'Purchase', NULL, FALSE, 'shopping-cart', 'unique'),
  (660, 'Purchase From RMC',                  '/purchase/rmc',                  'Purchase', NULL, FALSE, 'shopping-cart', 'unique'),

  -- Sells
  (700, 'Sell To Corporate/Individual', '/sell/corporate-individual', 'Sells', NULL, FALSE, 'tag', 'unique'),
  (710, 'Sell To Foreign',              '/sell/sell-foreign',         'Sells', NULL, FALSE, 'tag', 'unique'),
  (720, 'Sell To Forex',                '/sell/sell-forex',           'Sells', NULL, FALSE, 'tag', 'unique'),
  (730, 'Sell To Franchise',            '/sell/sell-franchise',       'Sells', NULL, FALSE, 'tag', 'unique'),
  (740, 'Sell To Misc',                 '/sell/sell-misc',            'Sells', NULL, FALSE, 'tag', 'unique'),
  (750, 'Sell To RMC',                  '/sell/rmc',                  'Sells', NULL, FALSE, 'tag', 'unique'),
  (760, 'Sells to FFMC/Ads',            '/sell/ffmc-ads',             'Sells', NULL, FALSE, 'tag', 'unique'),

  -- Transfer
  (800, 'Branch Transfer',  '/transfer/branch',  'Transfer', NULL, FALSE, 'arrow-left-right', 'unique'),
  (810, 'Counter Transfer', '/transfer/counter', 'Transfer', NULL, FALSE, 'arrow-left-right', 'unique'),

  -- Reports
  (900, 'Currency Balance Reports',    '/reports/currency-balance',      'Reports', '/reports', FALSE, 'bar-chart', 'unique'),
  (910, 'Product Profit Reports',      '/reports/product-profit-report', 'Reports', '/reports', FALSE, 'bar-chart', 'unique'),
  (920, 'Sale & Purchase Reports',     '/reports/sale-purchase-report',  'Reports', '/reports', FALSE, 'bar-chart', 'unique'),
  (930, 'Settled CARD Report',         '/reports/card-settled-report',   'Reports', '/reports', FALSE, 'bar-chart', 'unique'),
  (940, 'Special Reports',             '/reports/special-reports',       'Reports', '/reports', FALSE, 'bar-chart', 'unique'),
  (950, 'Stock Revaluations',          '/stock-revaluations',            'Reports', '/reports', FALSE, 'scale',     'unique'),
  (960, 'Unsettled CARD Report',       '/reports/card-unsettled-report', 'Reports', '/reports', FALSE, 'bar-chart', 'unique'),

  -- Reports > FLM
  (965, 'FLM Reports', '/reports/flm', 'Reports', '/reports', FALSE, 'bar-chart', 'group'),
  (970, 'FLM1 Daily CN Summary',       '/reports/flm1-daily-cn-summary', 'FLM', '/reports/flm', FALSE, 'bar-chart', 'unique'),
  (980, 'FLM 2 - Encashed TC Balance',         '/reports/flm2-daily-et-summary', 'FLM', '/reports/flm', FALSE, 'bar-chart', 'unique'),
  (990, 'FLM 3 - Purchase from Public', '/reports/flm3-purchase-from-public', 'FLM', '/reports/flm', FALSE, 'bar-chart', 'unique'),
  (995, 'FLM 4 - Purchase from FFMC', '/reports/flm4-purchase-from-ffmc', 'FLM', '/reports/flm', FALSE, 'bar-chart', 'unique'),
  (996, 'FLM 5 - Sales to Public', '/reports/flm5-sales-to-public', 'FLM', '/reports/flm', FALSE, 'bar-chart', 'unique'),
  (997, 'FLM 6 - Sales to FFMC', '/reports/flm6-sales-to-ffmc', 'FLM', '/reports/flm', FALSE, 'bar-chart', 'unique'),
  (998, 'FLM 7 - Surrender Statement', '/reports/flm7-surrender-statement', 'FLM', '/reports/flm', FALSE, 'bar-chart', 'unique'),
  (999, 'FLM 8 - CN Statement', '/reports/flm8-cn-statement', 'FLM', '/reports/flm', FALSE, 'bar-chart', 'unique'),

  -- Party Profiles
  (1000, 'Corporate Client Profile',      '/party-profiles/corporate-client',      'Party Profiles', NULL, FALSE, 'users',       'unique'),
  (1010, 'Ffmc Profile',                  '/party-profiles/ffmc',                  'Party Profiles', NULL, FALSE, 'badge-check', 'unique'),
  (1020, 'Ad1 Referral Profile',          '/party-profiles/rf',                    'Party Profiles', NULL, FALSE, 'badge-check', 'unique'),
  (1030, 'Authorised Dealer Profile',     '/party-profiles/authorised-dealer',     'Party Profiles', NULL, FALSE, 'badge-check', 'unique'),
  (1040, 'Rmc Profile',                   '/party-profiles/rmc',                   'Party Profiles', NULL, FALSE, 'badge-check', 'unique'),
  (1050, 'Franchise Profile',             '/party-profiles/franchise',             'Party Profiles', NULL, FALSE, 'badge-check', 'unique'),
  (1060, 'Agent Profile',                 '/party-profiles/agent',                 'Party Profiles', NULL, FALSE, 'badge-check', 'unique'),
  (1070, 'Foreign Correspondent Profile', '/party-profiles/foreign-correspondent', 'Party Profiles', NULL, FALSE, 'badge-check', 'unique'),
  (1080, 'Forex Correspondent Profile',   '/party-profiles/forex-correspondent',   'Party Profiles', NULL, FALSE, 'badge-check', 'unique'),
  (1090, 'Marketing Executive Profile',   '/party-profiles/marketing-executive',   'Party Profiles', NULL, FALSE, 'badge-check', 'unique'),
  (1100, 'Card Issuer Profile',           '/party-profiles/card-issuer-profile',   'Party Profiles', NULL, FALSE, 'badge-check', 'unique'),
  (1110, 'Misc Supplier Profile',         '/party-profiles/misc-supplier-profile', 'Party Profiles', NULL, FALSE, 'badge-check', 'unique'),

  -- Admin > Organization
  (1200, 'Company Profile', '/admin/company-profile', 'Organization', NULL, FALSE, 'building', 'unique'),
  (1210, 'Branch Profile',  '/admin/branch-profile',  'Organization', NULL, FALSE, 'sitemap',  'unique'),
  (1220, 'Counter Profile', '/admin/counter-profile', 'Organization', NULL, FALSE, 'counter',  'unique'),

  -- Admin > Access
  (1300, 'User Profile',     '/user-profile',            'Access', NULL, FALSE, 'users',  'unique'),
  (1310, 'User Role',        '/admin/user-role',         'Access', NULL, FALSE, 'shield', 'unique'),
  (1320, 'Menu Management',  '/admin/menu-management',   'Access', NULL, FALSE, 'menu',   'unique'),

  -- Admin > Products & Rates
  (1400, 'Product Profile',  '/admin/product-profile',   'Products & Rates', NULL, FALSE, 'archive',     'unique'),
  (1410, 'Currency Profile', '/currency-profile',        'Products & Rates', NULL, FALSE, 'dollar-sign', 'unique'),
  (1420, 'Currency Rates',   '/admin/currency-rates',    'Products & Rates', NULL, FALSE, 'dollar-sign', 'unique'),

  -- Admin > Geography
  (1500, 'Country Profile', '/admin/country-profile', 'Geography', NULL, FALSE, 'globe', 'unique'),
  (1510, 'Country Group',   '/admin/country-group',   'Geography', NULL, FALSE, 'globe', 'unique'),
  (1520, 'State Profile',   '/admin/state-profile',   'Geography', NULL, FALSE, 'map',   'unique'),

  -- Admin > Financial
  (1600, 'Financial Profile',       '/financial-profile',       'Financial', NULL, FALSE, 'dollar-sign', 'unique'),
  (1610, 'Accounts Profile',        '/admin/accounts-profile',  'Financial', NULL, FALSE, 'book',        'unique'),
  (1620, 'Tds Profile',             '/admin/tds-profile',       'Financial', NULL, FALSE, 'receipt',     'unique'),
  (1630, 'Expense Booking Master',  '/expense-booking',         'Financial', NULL, FALSE, 'receipt',     'unique'),
  (1640, 'Income Booking Master',   '/income-booking',          'Financial', NULL, FALSE, 'credit-card', 'unique'),

  -- Admin > Configuration
  (1700, 'Document Profile',      '/admin/document-profile',      'Configuration', NULL, FALSE, 'file-text',    'unique'),
  (1710, 'Miscellaneous Profile', '/admin/miscellaneous-profile', 'Configuration', NULL, FALSE, 'layout-grid',  'unique'),
  (1720, 'Purpose master',        '/admin/purpose',               'Configuration', NULL, FALSE, 'receipt-text', 'unique'),
  (1725, 'Purpose group master',  '/admin/purpose-group',         'Configuration', NULL, FALSE, 'layers',       'unique'),
  (1730, 'Additional Settings',   '/admin/additional-settings',   'Configuration', NULL, FALSE, 'settings',     'unique');

  FOR r IN
    SELECT * FROM menu_spec ORDER BY ord
  LOOP
    v_parent_id := NULL;
    v_existing_id := NULL;

    IF r.parent_name IS NOT NULL THEN
      SELECT m.id
      INTO v_parent_id
      FROM menus m
      WHERE m.deleted_at IS NULL
        AND m.name = r.parent_name
        AND (
          (r.parent_path IS NULL AND m.path IS NULL)
          OR (r.parent_path IS NOT NULL AND m.path = r.parent_path)
        )
      ORDER BY
        CASE WHEN EXISTS (
          SELECT 1 FROM menus c WHERE c.parent_id = m.id AND c.deleted_at IS NULL
        ) THEN 0 ELSE 1 END,
        m.created_at ASC
      LIMIT 1;

      IF v_parent_id IS NULL THEN
        RAISE EXCEPTION 'Parent not found for "%" (parent_name=%, parent_path=%)',
          r.name, r.parent_name, r.parent_path;
      END IF;
    END IF;

    IF r.match_role = 'folder' THEN
      SELECT m.id
      INTO v_existing_id
      FROM menus m
      WHERE m.deleted_at IS NULL
        AND m.path IS NULL
        AND m.name = r.name
      ORDER BY
        CASE WHEN m.parent_id IS NOT DISTINCT FROM v_parent_id THEN 0 ELSE 1 END,
        m.created_at ASC
      LIMIT 1;
    ELSIF r.match_role = 'group' THEN
      SELECT m.id
      INTO v_existing_id
      FROM menus m
      WHERE m.deleted_at IS NULL
        AND m.path = r.path
      ORDER BY
        CASE WHEN m.parent_id IS NOT DISTINCT FROM v_parent_id THEN 0 ELSE 1 END,
        CASE WHEN EXISTS (
          SELECT 1 FROM menus c WHERE c.parent_id = m.id AND c.deleted_at IS NULL
        ) THEN 0 ELSE 1 END,
        CASE WHEN m.parent_id IS NULL THEN 0 ELSE 1 END,
        m.created_at ASC
      LIMIT 1;
    ELSIF r.match_role = 'leaf' THEN
      SELECT m.id
      INTO v_existing_id
      FROM menus m
      WHERE m.deleted_at IS NULL
        AND m.path = r.path
      ORDER BY
        CASE WHEN m.parent_id IS NOT DISTINCT FROM v_parent_id THEN 0 ELSE 1 END,
        CASE WHEN EXISTS (
          SELECT 1 FROM menus c WHERE c.parent_id = m.id AND c.deleted_at IS NULL
        ) THEN 1 ELSE 0 END,
        CASE WHEN m.parent_id IS NOT NULL THEN 0 ELSE 1 END,
        m.created_at ASC
      LIMIT 1;
    ELSE
      SELECT m.id
      INTO v_existing_id
      FROM menus m
      WHERE m.deleted_at IS NULL
        AND m.path = r.path
      ORDER BY
        CASE WHEN m.parent_id IS NOT DISTINCT FROM v_parent_id THEN 0 ELSE 1 END,
        m.created_at ASC
      LIMIT 1;
    END IF;

    IF v_existing_id IS NOT NULL THEN
      UPDATE menus
      SET
        parent_id = v_parent_id,
        sort_order = 0,
        is_admin = r.is_admin,
        is_active = TRUE,
        updated_at = NOW(),
        updated_by = v_system_user
      WHERE id = v_existing_id;
      v_updated := v_updated + 1;
    ELSE
      INSERT INTO menus (
        id,
        is_admin,
        name,
        path,
        icon,
        parent_id,
        sort_order,
        is_active,
        created_by,
        updated_by
      ) VALUES (
        gen_random_uuid(),
        r.is_admin,
        r.name,
        r.path,
        r.icon,
        v_parent_id,
        0,
        TRUE,
        v_system_user,
        v_system_user
      );
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  UPDATE menus
  SET
    sort_order = 0,
    updated_at = NOW(),
    updated_by = v_system_user
  WHERE deleted_at IS NULL
    AND sort_order IS DISTINCT FROM 0;

  RAISE NOTICE 'Menu upsert completed. inserted=%, updated=%', v_inserted, v_updated;
END $$;

-- Review the tree after running (A-Z within each parent).
WITH RECURSIVE tree AS (
  SELECT
    m.id,
    m.name,
    m.path,
    m.parent_id,
    m.is_admin,
    0 AS depth,
    m.name::TEXT AS sort_key
  FROM menus m
  WHERE m.parent_id IS NULL
    AND m.deleted_at IS NULL
  UNION ALL
  SELECT
    c.id,
    c.name,
    c.path,
    c.parent_id,
    c.is_admin,
    t.depth + 1,
    t.sort_key || '/' || c.name::TEXT
  FROM menus c
  JOIN tree t ON c.parent_id = t.id
  WHERE c.deleted_at IS NULL
)
SELECT
  repeat('  ', depth) || name AS item,
  COALESCE(path, '(folder)') AS path,
  is_admin
FROM tree
ORDER BY sort_key;
