-- Junction table: maps products to flyer pages with position data (bbox).
-- This is the single source of truth for product-page associations.
-- The old products.flyer_id / products.flyer_page columns are deprecated.

CREATE TABLE flyer_page_products (
  flyer_id UUID NOT NULL REFERENCES flyers(flyer_id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK (page_number >= 1),
  product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  price_in_flyer NUMERIC(10,2),
  bbox JSONB,  -- {"x_min":0-1000,"y_min":0-1000,"x_max":0-1000,"y_max":0-1000}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (flyer_id, page_number, product_id)
);

CREATE INDEX idx_fpp_product ON flyer_page_products (product_id);

ALTER TABLE flyer_page_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read flyer_page_products" ON flyer_page_products
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Allow insert flyer_page_products" ON flyer_page_products
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update flyer_page_products" ON flyer_page_products
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow delete flyer_page_products" ON flyer_page_products
  FOR DELETE TO authenticated USING (true);
