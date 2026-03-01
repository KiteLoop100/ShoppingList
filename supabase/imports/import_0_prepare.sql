-- ALDI Data Import: Part 0 – Prepare (Schema + Backup + Cleanup)
-- Run in Supabase SQL Editor
-- Generated: 2026-02-27

-- ═══════════════════════════════════════════════════════════
-- 0a. Schema additions for new fields
-- ═══════════════════════════════════════════════════════════

-- Products: new columns from ALDI data
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS receipt_abbreviation TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS base_price_text TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS availability_scope TEXT DEFAULT 'national';

-- Stores: external ALDI store ID + region + opening hours
ALTER TABLE stores ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS opening_hours TEXT;
CREATE INDEX IF NOT EXISTS idx_stores_external_id ON stores (external_id) WHERE external_id IS NOT NULL;

-- Update assortment_type constraint if needed
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_assortment_type_check;
ALTER TABLE products ADD CONSTRAINT products_assortment_type_check
  CHECK (assortment_type IN ('daily_range', 'special', 'special_food', 'special_nonfood'));

-- ═══════════════════════════════════════════════════════════
-- 0b. Backup existing data
-- ═══════════════════════════════════════════════════════════

-- Archive tables (safe copy before deletion)
CREATE TABLE IF NOT EXISTS products_archive_20260227 AS SELECT * FROM products;
CREATE TABLE IF NOT EXISTS stores_archive_20260227 AS SELECT * FROM stores;
CREATE TABLE IF NOT EXISTS categories_archive_20260227 AS SELECT * FROM categories;
CREATE TABLE IF NOT EXISTS list_items_archive_20260227 AS SELECT * FROM list_items;

-- ═══════════════════════════════════════════════════════════
-- 0c. Delete existing data (order matters for FK constraints!)
-- ═══════════════════════════════════════════════════════════

-- Dependent tables first
DELETE FROM trip_items;
DELETE FROM shopping_trips;
DELETE FROM checkoff_sequences;
DELETE FROM sorting_errors;
DELETE FROM user_product_preferences;
DELETE FROM aisle_orders;
DELETE FROM aggregated_aisle_orders;
DELETE FROM list_items;
DELETE FROM shopping_lists;
DELETE FROM pairwise_order;
DELETE FROM auto_reorder_settings;
DELETE FROM receipt_items;
DELETE FROM receipts;

-- Then main tables
DELETE FROM products;
DELETE FROM stores;
DELETE FROM categories;

-- ═══════════════════════════════════════════════════════════
-- 0d. Verify clean state
-- ═══════════════════════════════════════════════════════════
SELECT 'products' as tbl, COUNT(*) FROM products
UNION ALL SELECT 'stores', COUNT(*) FROM stores
UNION ALL SELECT 'categories', COUNT(*) FROM categories;
