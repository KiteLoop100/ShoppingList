-- Add product-specific aliases (alternative names / search terms) to both product tables.
-- Used for display on detail pages, editing via capture modal, and search matching.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS aliases text[] DEFAULT '{}';

ALTER TABLE competitor_products
  ADD COLUMN IF NOT EXISTS aliases text[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_products_aliases
  ON products USING GIN (aliases);

CREATE INDEX IF NOT EXISTS idx_competitor_products_aliases
  ON competitor_products USING GIN (aliases);
