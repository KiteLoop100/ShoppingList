-- Digital Shopping List – Initial schema (DATA-MODEL.md)
-- Run in Supabase SQL Editor or via: supabase db push

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Categories (reference data)
CREATE TABLE categories (
  category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_translations JSONB NOT NULL DEFAULT '{}',
  icon TEXT NOT NULL DEFAULT '📦',
  default_sort_position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products
CREATE TABLE products (
  product_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(category_id),
  price NUMERIC(10, 2),
  price_updated_at TIMESTAMPTZ,
  assortment_type TEXT NOT NULL CHECK (assortment_type IN ('daily_range', 'special')),
  availability TEXT NOT NULL DEFAULT 'national' CHECK (availability IN ('national', 'regional')),
  region TEXT,
  special_start_date DATE,
  special_end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  source TEXT NOT NULL CHECK (source IN ('admin', 'crowdsourcing')),
  crowdsource_status TEXT CHECK (crowdsource_status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_name_normalized ON products (name_normalized);
CREATE INDEX idx_products_category_id ON products (category_id);
CREATE INDEX idx_products_status ON products (status);

-- Stores
CREATE TABLE stores (
  store_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  has_sorting_data BOOLEAN NOT NULL DEFAULT false,
  sorting_data_quality INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stores_country ON stores (country);
CREATE INDEX idx_stores_location ON stores (latitude, longitude);

-- Users (anonymous-first; auth.users is managed by Supabase Auth)
CREATE TABLE users (
  user_id UUID PRIMARY KEY,
  device_id TEXT,
  email TEXT,
  is_registered BOOLEAN NOT NULL DEFAULT false,
  preferred_language TEXT NOT NULL DEFAULT 'de' CHECK (preferred_language IN ('de', 'en')),
  default_store_id UUID REFERENCES stores(store_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_device_id ON users (device_id);

-- Shopping lists
CREATE TABLE shopping_lists (
  list_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id),
  store_id UUID REFERENCES stores(store_id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_shopping_lists_user_status ON shopping_lists (user_id, status);

-- List items
CREATE TABLE list_items (
  item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES shopping_lists(list_id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(product_id),
  custom_name TEXT,
  display_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  is_checked BOOLEAN NOT NULL DEFAULT false,
  checked_at TIMESTAMPTZ,
  sort_position INTEGER NOT NULL DEFAULT 0,
  category_id UUID NOT NULL REFERENCES categories(category_id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_list_items_list_id ON list_items (list_id);
CREATE INDEX idx_list_items_category ON list_items (list_id, category_id, sort_position);

-- Shopping trips
CREATE TABLE shopping_trips (
  trip_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id),
  store_id UUID REFERENCES stores(store_id),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER NOT NULL,
  total_items INTEGER NOT NULL,
  estimated_total_price NUMERIC(10, 2),
  sorting_errors_reported INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shopping_trips_user ON shopping_trips (user_id, created_at DESC);

-- Trip items
CREATE TABLE trip_items (
  trip_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES shopping_trips(trip_id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(product_id),
  custom_name TEXT,
  display_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price_at_purchase NUMERIC(10, 2),
  category_id UUID NOT NULL REFERENCES categories(category_id),
  check_position INTEGER NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL,
  was_removed BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_trip_items_trip ON trip_items (trip_id);

-- User product preferences (one of product_id or generic_name must be set)
CREATE TABLE user_product_preferences (
  user_id UUID NOT NULL REFERENCES users(user_id),
  product_id UUID REFERENCES products(product_id),
  generic_name TEXT,
  purchase_count INTEGER NOT NULL DEFAULT 0,
  last_purchased_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_user_product UNIQUE (user_id, product_id, generic_name),
  CONSTRAINT chk_pref_key CHECK (
    (product_id IS NOT NULL AND generic_name IS NULL) OR
    (product_id IS NULL AND generic_name IS NOT NULL)
  )
);

CREATE UNIQUE INDEX idx_user_prefs_specific ON user_product_preferences (user_id, product_id) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX idx_user_prefs_generic ON user_product_preferences (user_id, generic_name) WHERE generic_name IS NOT NULL;

CREATE INDEX idx_user_prefs_user ON user_product_preferences (user_id);

-- Aisle order (per store)
CREATE TABLE aisle_orders (
  store_id UUID NOT NULL REFERENCES stores(store_id),
  category_id UUID NOT NULL REFERENCES categories(category_id),
  learned_position INTEGER NOT NULL,
  confidence NUMERIC(3, 2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  data_points INTEGER NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, category_id)
);

CREATE INDEX idx_aisle_orders_store ON aisle_orders (store_id, learned_position);

-- Checkoff sequences
CREATE TABLE checkoff_sequences (
  sequence_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES shopping_trips(trip_id),
  store_id UUID NOT NULL REFERENCES stores(store_id),
  user_id UUID NOT NULL REFERENCES users(user_id),
  is_valid BOOLEAN NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checkoff_trip ON checkoff_sequences (trip_id);

-- Sorting errors
CREATE TABLE sorting_errors (
  error_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id),
  store_id UUID NOT NULL REFERENCES stores(store_id),
  trip_id UUID REFERENCES shopping_trips(trip_id),
  current_sort_order JSONB,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigated', 'resolved'))
);

CREATE INDEX idx_sorting_errors_store ON sorting_errors (store_id, status);

-- Aggregated aisle order (fallback across all stores)
CREATE TABLE aggregated_aisle_orders (
  category_id UUID NOT NULL PRIMARY KEY REFERENCES categories(category_id),
  average_position NUMERIC(10, 2) NOT NULL,
  std_deviation NUMERIC(10, 2),
  contributing_stores INTEGER NOT NULL DEFAULT 0,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row Level Security: users see only their own data
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_product_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkoff_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sorting_errors ENABLE ROW LEVEL SECURITY;

-- Public read for reference data (products, categories, stores – can be restricted later)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE aisle_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE aggregated_aisle_orders ENABLE ROW LEVEL SECURITY;

-- Policies: use auth.uid() for authenticated users; for anonymous, we'll use a custom claim or app-level checks
-- Placeholder policies (adjust when Supabase Auth is wired: anonymous or email)
CREATE POLICY "Users can read own row" ON users FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own row" ON users FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own row" ON users FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own lists" ON shopping_lists FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own list items" ON list_items FOR ALL USING (
  EXISTS (SELECT 1 FROM shopping_lists sl WHERE sl.list_id = list_items.list_id AND sl.user_id = auth.uid())
);
CREATE POLICY "Users can manage own trips" ON shopping_trips FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own trip items" ON trip_items FOR ALL USING (
  EXISTS (SELECT 1 FROM shopping_trips st WHERE st.trip_id = trip_items.trip_id AND st.user_id = auth.uid())
);
CREATE POLICY "Users can manage own preferences" ON user_product_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own checkoff sequences" ON checkoff_sequences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own sorting errors" ON sorting_errors FOR ALL USING (auth.uid() = user_id);

-- Reference data: allow read for authenticated and anon
CREATE POLICY "Allow read categories" ON categories FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow read products" ON products FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow read stores" ON stores FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow read aisle_orders" ON aisle_orders FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow read aggregated_aisle_orders" ON aggregated_aisle_orders FOR SELECT TO authenticated, anon USING (true);

-- Service role can write reference data (admin); anon/authenticated read-only
CREATE POLICY "Allow insert products for authenticated" ON products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update products for authenticated" ON products FOR UPDATE TO authenticated USING (true);
