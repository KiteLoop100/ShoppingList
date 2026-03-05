-- Add detailed product information columns to competitor_products.
-- These fields are populated by the product photo studio pipeline
-- from crowdsourced product photos (ingredients, nutrition, etc.).

ALTER TABLE competitor_products
  ADD COLUMN IF NOT EXISTS ingredients TEXT,
  ADD COLUMN IF NOT EXISTS nutrition_info JSONB,
  ADD COLUMN IF NOT EXISTS allergens TEXT,
  ADD COLUMN IF NOT EXISTS nutri_score TEXT CHECK (nutri_score IN ('A', 'B', 'C', 'D', 'E')),
  ADD COLUMN IF NOT EXISTS country_of_origin TEXT;
