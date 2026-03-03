-- BL-62 Phase 2: Add demand_group_code to list_items and trip_items.
-- Migrate existing data from category_id → demand_group_code via products
-- and via a category→demand_group mapping for generic entries.

-- =====================================================================
-- 1. Add demand_group_code column to list_items
-- =====================================================================
ALTER TABLE list_items ADD COLUMN IF NOT EXISTS demand_group_code TEXT
  REFERENCES demand_groups(code);

CREATE INDEX IF NOT EXISTS idx_list_items_demand_group_code
  ON list_items (demand_group_code);

-- =====================================================================
-- 2. Add demand_group_code column to trip_items
-- =====================================================================
ALTER TABLE trip_items ADD COLUMN IF NOT EXISTS demand_group_code TEXT
  REFERENCES demand_groups(code);

CREATE INDEX IF NOT EXISTS idx_trip_items_demand_group_code
  ON trip_items (demand_group_code);

-- =====================================================================
-- 3. Populate list_items.demand_group_code from products
-- =====================================================================
-- For items WITH a product_id: use the product's demand_group_code
UPDATE list_items li
SET demand_group_code = p.demand_group_code
FROM products p
WHERE li.product_id = p.product_id
  AND p.demand_group_code IS NOT NULL
  AND li.demand_group_code IS NULL;

-- For items WITHOUT a product_id (generic entries):
-- Try to map the old category_id UUID to a demand_group_code.
-- This uses the category name to find the closest demand_group.
-- If no match is found, items keep NULL (will be assigned by the app).
UPDATE list_items li
SET demand_group_code = COALESCE(
  (SELECT dg.code FROM demand_groups dg
   JOIN categories c ON c.category_id = li.category_id
   WHERE dg.name ILIKE '%' || c.name || '%'
   LIMIT 1),
  -- Fallback: use a broad mapping for common EN category names
  CASE
    WHEN li.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Dairy') THEN '83'
    WHEN li.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Bakery') THEN '57'
    WHEN li.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Fruits & Vegetables') THEN '38'
    WHEN li.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Fresh Meat & Fish') THEN '68'
    WHEN li.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Freezer') THEN '75'
    WHEN li.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Pantry') THEN '54'
    WHEN li.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Breakfast') THEN '90'
    WHEN li.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Chilled Convenience') THEN '73'
    WHEN li.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Non-Alcoholic Beverages') THEN '05'
    WHEN li.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Alcoholic Beverages') THEN '04'
    WHEN li.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Snacking') THEN '41'
    WHEN li.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Health, Beauty & Baby') THEN '07'
    WHEN li.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Household') THEN '25'
    WHEN li.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Home Improvement') THEN '25'
    WHEN li.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Electronics') THEN 'AK'
    WHEN li.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Fashion') THEN 'AK'
    WHEN li.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Outdoor/Leisure') THEN 'AK'
    WHEN li.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Services') THEN 'AK'
    WHEN li.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Sonstiges') THEN 'AK'
    WHEN li.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Aktionsartikel') THEN 'AK'
    ELSE NULL
  END
)
WHERE li.demand_group_code IS NULL;

-- =====================================================================
-- 4. Populate trip_items.demand_group_code from products
-- =====================================================================
UPDATE trip_items ti
SET demand_group_code = p.demand_group_code
FROM products p
WHERE ti.product_id = p.product_id
  AND p.demand_group_code IS NOT NULL
  AND ti.demand_group_code IS NULL;

-- Same fallback for generic trip_items
UPDATE trip_items ti
SET demand_group_code = COALESCE(
  (SELECT dg.code FROM demand_groups dg
   JOIN categories c ON c.category_id = ti.category_id
   WHERE dg.name ILIKE '%' || c.name || '%'
   LIMIT 1),
  CASE
    WHEN ti.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Dairy') THEN '83'
    WHEN ti.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Bakery') THEN '57'
    WHEN ti.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Fruits & Vegetables') THEN '38'
    WHEN ti.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Fresh Meat & Fish') THEN '68'
    WHEN ti.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Freezer') THEN '75'
    WHEN ti.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Pantry') THEN '54'
    WHEN ti.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Breakfast') THEN '90'
    WHEN ti.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Chilled Convenience') THEN '73'
    WHEN ti.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Non-Alcoholic Beverages') THEN '05'
    WHEN ti.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Alcoholic Beverages') THEN '04'
    WHEN ti.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Snacking') THEN '41'
    WHEN ti.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Health, Beauty & Baby') THEN '07'
    WHEN ti.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Household') THEN '25'
    WHEN ti.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Home Improvement') THEN '25'
    WHEN ti.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Electronics') THEN 'AK'
    WHEN ti.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Fashion') THEN 'AK'
    WHEN ti.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Outdoor/Leisure') THEN 'AK'
    WHEN ti.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Services') THEN 'AK'
    WHEN ti.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Sonstiges') THEN 'AK'
    WHEN ti.category_id IN (SELECT c2.category_id FROM categories c2 WHERE c2.name = 'Aktionsartikel') THEN 'AK'
    ELSE NULL
  END
)
WHERE ti.demand_group_code IS NULL;
