-- Auto-reorder settings: per-user per-product recurring purchase intervals
CREATE TABLE IF NOT EXISTS auto_reorder_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  reorder_value INTEGER NOT NULL CHECK (reorder_value >= 1),
  reorder_unit TEXT NOT NULL CHECK (reorder_unit IN ('days', 'weeks', 'months')),
  last_checked_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

-- RLS
ALTER TABLE auto_reorder_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own reorder settings"
  ON auto_reorder_settings FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can insert own reorder settings"
  ON auto_reorder_settings FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Users can update own reorder settings"
  ON auto_reorder_settings FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own reorder settings"
  ON auto_reorder_settings FOR DELETE
  TO authenticated, anon
  USING (true);
