-- Add typical_shelf_life_days to products and competitor_products.
-- Stores the typical number of days from purchase to best-before date.
-- Used to auto-calculate best_before on inventory items during receipt processing.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS typical_shelf_life_days SMALLINT DEFAULT NULL;

ALTER TABLE competitor_products
  ADD COLUMN IF NOT EXISTS typical_shelf_life_days SMALLINT DEFAULT NULL;

COMMENT ON COLUMN products.typical_shelf_life_days
  IS 'Typical number of days from purchase to best-before date';
COMMENT ON COLUMN competitor_products.typical_shelf_life_days
  IS 'Typical number of days from purchase to best-before date';
