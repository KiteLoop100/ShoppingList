-- Add category/subcategory/assortment fields to competitor_products
-- to support the unified product capture module.

ALTER TABLE competitor_products ADD COLUMN IF NOT EXISTS demand_group_code TEXT;
ALTER TABLE competitor_products ADD COLUMN IF NOT EXISTS demand_sub_group TEXT;
ALTER TABLE competitor_products ADD COLUMN IF NOT EXISTS assortment_type TEXT DEFAULT 'daily_range';
