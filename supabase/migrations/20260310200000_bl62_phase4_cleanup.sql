-- BL-62 Phase 4: Drop legacy category columns and tables
--
-- Prerequisites:
--   - Phase 1-3 completed: demand_group_code is the primary key everywhere
--   - BL-63 data cleanup (20260310100000) applied: demand_sub_group values normalized
--
-- This migration drops:
--   1. products.category_id (legacy FK, no longer used by frontend)
--   2. products.demand_group (legacy text field, replaced by demand_group_code FK)
--   3. competitor_products.category_id (legacy FK, orphaned after categories table drop)
--   4. category_aliases table (if it still exists)

BEGIN;

-- 1. Drop products.category_id
ALTER TABLE products DROP COLUMN IF EXISTS category_id;

-- 2. Drop products.demand_group (legacy text field like "83-Milch/Sahne/Butter")
ALTER TABLE products DROP COLUMN IF EXISTS demand_group;

-- 3. Drop competitor_products.category_id
ALTER TABLE competitor_products DROP COLUMN IF EXISTS category_id;

-- 4. Drop category_aliases table (was in initial schema, may have been dropped already)
DROP TABLE IF EXISTS category_aliases;

COMMIT;
