-- Add dietary/lifestyle flags to competitor_products (same as products table)
ALTER TABLE competitor_products
  ADD COLUMN IF NOT EXISTS is_bio BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_vegan BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_gluten_free BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_lactose_free BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS animal_welfare_level INTEGER DEFAULT NULL;
