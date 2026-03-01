-- Receipts: scanned receipt data per user
-- Each receipt = one shopping trip captured via receipt photo(s)

CREATE TABLE receipts (
  receipt_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  store_name TEXT,
  store_address TEXT,
  purchase_date DATE,
  purchase_time TIME,
  total_amount NUMERIC(10, 2),
  payment_method TEXT,
  currency TEXT NOT NULL DEFAULT 'EUR',
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  raw_ocr_data JSONB,
  extra_info JSONB,
  items_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_receipts_user_date ON receipts (user_id, purchase_date DESC);
CREATE INDEX idx_receipts_created ON receipts (created_at DESC);

-- Receipt line items
CREATE TABLE receipt_items (
  receipt_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id UUID NOT NULL REFERENCES receipts(receipt_id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  article_number TEXT,
  receipt_name TEXT NOT NULL,
  product_id UUID REFERENCES products(product_id),
  quantity NUMERIC(10, 3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2),
  total_price NUMERIC(10, 2),
  is_weight_item BOOLEAN NOT NULL DEFAULT false,
  weight_kg NUMERIC(10, 3),
  tax_category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_receipt_items_receipt ON receipt_items (receipt_id, position);
CREATE INDEX idx_receipt_items_product ON receipt_items (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_receipt_items_article ON receipt_items (article_number) WHERE article_number IS NOT NULL;

-- RLS
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert receipts" ON receipts FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "Allow select receipts" ON receipts FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow update receipts" ON receipts FOR UPDATE TO authenticated, anon USING (true);
CREATE POLICY "Allow delete receipts" ON receipts FOR DELETE TO authenticated, anon USING (true);

CREATE POLICY "Allow insert receipt_items" ON receipt_items FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "Allow select receipt_items" ON receipt_items FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow update receipt_items" ON receipt_items FOR UPDATE TO authenticated, anon USING (true);
CREATE POLICY "Allow delete receipt_items" ON receipt_items FOR DELETE TO authenticated, anon USING (true);
