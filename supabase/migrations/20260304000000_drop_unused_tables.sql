-- Drop unused legacy tables and finish BL-62 Phase 4 (category_id cleanup).
--
-- Tables dropped (all empty, 0 rows):
--   users, aisle_orders, aggregated_aisle_orders, sorting_errors,
--   user_product_preferences
--
-- Table dropped (20 rows of seed data, fully replaced by demand_groups):
--   categories
--
-- Columns dropped:
--   list_items.category_id  (all 136 rows already have demand_group_code)
--   trip_items.category_id  (all 51 rows already have demand_group_code)
--
-- Column kept (FK removed):
--   products.category_id    (9133 values; kept for historical reference)
--   competitor_products.category_id (0 values; FK removed)

-- =====================================================================
-- Step 0: Backfill demand_group_code for 1591 products that only have
--         category_id (these were missed by the BL-62 migration because
--         their demand_group text column was NULL).
-- =====================================================================
UPDATE products
SET demand_group_code = CASE
    WHEN c.name = 'Fruits & Vegetables'     THEN '38'
    WHEN c.name = 'Household'               THEN '25'
    WHEN c.name = 'Home Improvement'        THEN '25'
    WHEN c.name IN ('Aktionsartikel', 'Fashion', 'Outdoor/Leisure',
                     'Electronics', 'Services', 'Sonstiges')
                                            THEN 'AK'
    ELSE 'AK'
END
FROM categories c
WHERE c.category_id = products.category_id
  AND products.demand_group_code IS NULL;

-- =====================================================================
-- Step 1: Drop FK constraints that reference the categories table
-- =====================================================================
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_id_fkey;
ALTER TABLE list_items DROP CONSTRAINT IF EXISTS list_items_category_id_fkey;
ALTER TABLE trip_items DROP CONSTRAINT IF EXISTS trip_items_category_id_fkey;
ALTER TABLE competitor_products DROP CONSTRAINT IF EXISTS competitor_products_category_id_fkey;

-- =====================================================================
-- Step 2: Drop category_id columns that are fully replaced
--         (list_items and trip_items; products.category_id is kept)
-- =====================================================================
ALTER TABLE list_items DROP COLUMN IF EXISTS category_id;
ALTER TABLE trip_items DROP COLUMN IF EXISTS category_id;

-- =====================================================================
-- Step 3: Drop unused tables
--         CASCADE removes remaining indexes, policies, and triggers.
-- =====================================================================

-- Empty tables (0 rows each, verified before migration)
DROP TABLE IF EXISTS aisle_orders CASCADE;
DROP TABLE IF EXISTS aggregated_aisle_orders CASCADE;
DROP TABLE IF EXISTS sorting_errors CASCADE;
DROP TABLE IF EXISTS user_product_preferences CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- categories: 20 seed rows, fully replaced by demand_groups (61 rows)
DROP TABLE IF EXISTS categories CASCADE;
