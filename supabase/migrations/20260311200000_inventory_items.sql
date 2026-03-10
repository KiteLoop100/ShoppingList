-- Household Inventory: inventory_items table + enable_inventory setting
-- Feature F42: Digital twin of products at home

-- 1. Add enable_inventory to user_settings
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS enable_inventory BOOLEAN NOT NULL DEFAULT false;

-- 2. Create inventory_items table
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,

  product_id UUID REFERENCES products(product_id),
  competitor_product_id UUID REFERENCES competitor_products(product_id),

  display_name TEXT NOT NULL,
  demand_group_code TEXT,
  thumbnail_url TEXT,

  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'sealed'
    CHECK (status IN ('sealed', 'opened', 'consumed')),

  source TEXT NOT NULL DEFAULT 'receipt'
    CHECK (source IN ('receipt', 'manual', 'barcode', 'photo')),
  source_receipt_id UUID REFERENCES receipts(receipt_id),

  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Partial unique constraints (named, for ON CONFLICT usage)
--    Only active (non-consumed) items must be unique per user+product
ALTER TABLE inventory_items
  ADD CONSTRAINT uq_inventory_user_product
  UNIQUE (user_id, product_id)
  -- PostgreSQL doesn't support WHERE on ALTER TABLE ADD CONSTRAINT UNIQUE.
  -- We use a partial unique index instead but name it for ON CONFLICT reference.
  ;

-- Drop the table-level constraint (can't have WHERE clause) and use index instead
ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS uq_inventory_user_product;

CREATE UNIQUE INDEX uq_inventory_user_product
  ON inventory_items (user_id, product_id)
  WHERE product_id IS NOT NULL AND status != 'consumed';

CREATE UNIQUE INDEX uq_inventory_user_competitor
  ON inventory_items (user_id, competitor_product_id)
  WHERE competitor_product_id IS NOT NULL AND status != 'consumed';

-- 4. Performance indexes
CREATE INDEX idx_inventory_user_status
  ON inventory_items (user_id, status)
  WHERE status != 'consumed';

CREATE INDEX idx_inventory_user_added
  ON inventory_items (user_id, added_at DESC);

-- 5. Row Level Security
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own inventory"
  ON inventory_items FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- 6. Enable realtime for inventory_items
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_items;
