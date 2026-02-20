-- Add columns from DATA-MODEL.md: article_number, ean_barcode, demand_group, demand_sub_group, popularity_score
ALTER TABLE products ADD COLUMN IF NOT EXISTS article_number TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ean_barcode TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS demand_group TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS demand_sub_group TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS popularity_score NUMERIC(12, 4);
CREATE INDEX IF NOT EXISTS idx_products_ean_barcode ON products (ean_barcode) WHERE ean_barcode IS NOT NULL;
