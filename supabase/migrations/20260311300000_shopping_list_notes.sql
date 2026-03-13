-- BL-71: Trip-level notes for shopping lists
ALTER TABLE shopping_lists
  ADD COLUMN IF NOT EXISTS notes TEXT;
