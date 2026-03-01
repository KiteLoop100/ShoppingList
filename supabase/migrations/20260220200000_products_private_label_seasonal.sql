-- Add is_private_label and is_seasonal columns to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_private_label BOOLEAN DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_seasonal BOOLEAN DEFAULT false;

-- Extend assortment_type CHECK constraint to include special_food and special_nonfood
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_assortment_type_check;
ALTER TABLE products ADD CONSTRAINT products_assortment_type_check
  CHECK (assortment_type IN ('daily_range', 'special', 'special_food', 'special_nonfood'));
