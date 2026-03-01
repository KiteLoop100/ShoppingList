-- B4: Competitor Product Database
-- Separate table for products from other retailers (LIDL, REWE, EDEKA, etc.)
-- Completely independent from the ALDI products table.

CREATE TABLE competitor_products (
  product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  brand TEXT,
  ean_barcode TEXT,
  article_number TEXT,
  weight_or_quantity TEXT,
  country TEXT NOT NULL DEFAULT 'DE',
  thumbnail_url TEXT,
  category_id UUID REFERENCES categories(category_id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users
);

CREATE INDEX idx_competitor_products_ean ON competitor_products (ean_barcode) WHERE ean_barcode IS NOT NULL;
CREATE INDEX idx_competitor_products_country ON competitor_products (country, status);
CREATE INDEX idx_competitor_products_name ON competitor_products (name_normalized);

-- Price history: append-only, one row per observed price per retailer.
-- Current price = latest row per (product_id, retailer).
CREATE TABLE competitor_product_prices (
  price_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES competitor_products(product_id) ON DELETE CASCADE,
  retailer TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  observed_by UUID REFERENCES auth.users
);

CREATE INDEX idx_competitor_prices_product ON competitor_product_prices (product_id, retailer, observed_at DESC);

-- Link list_items to competitor products (optional, like product_id links to ALDI products)
ALTER TABLE list_items
  ADD COLUMN competitor_product_id UUID REFERENCES competitor_products(product_id);

-- RLS
ALTER TABLE competitor_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_product_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read competitor_products" ON competitor_products
  FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow insert competitor_products" ON competitor_products
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update competitor_products" ON competitor_products
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow read competitor_product_prices" ON competitor_product_prices
  FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow insert competitor_product_prices" ON competitor_product_prices
  FOR INSERT TO authenticated WITH CHECK (true);
