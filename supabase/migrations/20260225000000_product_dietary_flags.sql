-- Product dietary/lifestyle flags for preference-based search ranking and allergen filtering
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_bio BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_vegan BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_gluten_free BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_lactose_free BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS animal_welfare_level INTEGER DEFAULT NULL;
-- animal_welfare_level: NULL = unknown, 1-4 = German "Haltungsform" (1=Stall, 4=Premium/Bio)
