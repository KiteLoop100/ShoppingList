-- Block 0: Account & Auth migration
-- Remove FK constraints that reference the custom users table,
-- so auth.uid() can be used directly without a custom users row.

-- Step 1: Drop ALL policies that depend on user_id columns FIRST
-- (must happen before ALTER COLUMN TYPE, otherwise Postgres rejects the change)
DROP POLICY IF EXISTS "Users can manage own lists" ON shopping_lists;
DROP POLICY IF EXISTS "Users can manage own list items" ON list_items;
DROP POLICY IF EXISTS "Users can manage own trips" ON shopping_trips;
DROP POLICY IF EXISTS "Users can manage own trip items" ON trip_items;
DROP POLICY IF EXISTS "Users can manage own preferences" ON user_product_preferences;
DROP POLICY IF EXISTS "Users can manage own checkoff sequences" ON checkoff_sequences;
DROP POLICY IF EXISTS "Users can manage own sorting errors" ON sorting_errors;

-- Step 2: Drop FK constraints
ALTER TABLE shopping_lists DROP CONSTRAINT IF EXISTS shopping_lists_user_id_fkey;
ALTER TABLE shopping_trips DROP CONSTRAINT IF EXISTS shopping_trips_user_id_fkey;
ALTER TABLE user_product_preferences DROP CONSTRAINT IF EXISTS user_product_preferences_user_id_fkey;
ALTER TABLE checkoff_sequences DROP CONSTRAINT IF EXISTS checkoff_sequences_user_id_fkey;
ALTER TABLE sorting_errors DROP CONSTRAINT IF EXISTS sorting_errors_user_id_fkey;

-- Step 3: Change user_id from UUID to TEXT for flexibility
-- (auth.uid() returns UUID string, compatible with TEXT)
ALTER TABLE shopping_lists ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE shopping_trips ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE user_product_preferences ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE checkoff_sequences ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE sorting_errors ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Step 4: Recreate policies with TEXT-compatible auth.uid()::TEXT
CREATE POLICY "Users can manage own lists" ON shopping_lists
  FOR ALL USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can manage own list items" ON list_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM shopping_lists sl
      WHERE sl.list_id = list_items.list_id
        AND sl.user_id = auth.uid()::TEXT
    )
  );

CREATE POLICY "Users can manage own trips" ON shopping_trips
  FOR ALL USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can manage own trip items" ON trip_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM shopping_trips st
      WHERE st.trip_id = trip_items.trip_id
        AND st.user_id = auth.uid()::TEXT
    )
  );

CREATE POLICY "Users can manage own preferences" ON user_product_preferences
  FOR ALL USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can manage own checkoff sequences" ON checkoff_sequences
  FOR ALL USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can manage own sorting errors" ON sorting_errors
  FOR ALL USING (auth.uid()::TEXT = user_id);
