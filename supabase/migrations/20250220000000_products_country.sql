-- Products: country for AT/DE filtering (product search)
ALTER TABLE products ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'DE';
CREATE INDEX IF NOT EXISTS idx_products_country ON products (country);
