-- User settings: syncs personal preferences across devices.
-- One row per user, upserted on save.

CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY,
  preferred_language TEXT NOT NULL DEFAULT 'de'
    CHECK (preferred_language IN ('de', 'en')),
  default_store_id UUID REFERENCES stores(store_id),
  exclude_gluten BOOLEAN NOT NULL DEFAULT false,
  exclude_lactose BOOLEAN NOT NULL DEFAULT false,
  exclude_nuts BOOLEAN NOT NULL DEFAULT false,
  prefer_cheapest BOOLEAN NOT NULL DEFAULT false,
  prefer_brand BOOLEAN NOT NULL DEFAULT false,
  prefer_bio BOOLEAN NOT NULL DEFAULT false,
  prefer_vegan BOOLEAN NOT NULL DEFAULT false,
  prefer_animal_welfare BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own settings" ON user_settings
  FOR SELECT USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE USING (auth.uid()::TEXT = user_id);
