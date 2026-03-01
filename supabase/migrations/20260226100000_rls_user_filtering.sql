-- Block 1: Row-Level Security – restrict all open USING(true) policies
-- to auth.uid()::text so users only see/modify their own data.
-- Depends on Block 0 (auth_account_migration) which established auth.uid().

-- =============================================
-- receipts: nur eigene Kassenzettel
-- =============================================
DROP POLICY IF EXISTS "Allow select receipts" ON receipts;
DROP POLICY IF EXISTS "Allow insert receipts" ON receipts;
DROP POLICY IF EXISTS "Allow update receipts" ON receipts;
DROP POLICY IF EXISTS "Allow delete receipts" ON receipts;

CREATE POLICY "Users read own receipts" ON receipts
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users insert own receipts" ON receipts
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users update own receipts" ON receipts
  FOR UPDATE USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users delete own receipts" ON receipts
  FOR DELETE USING (user_id = auth.uid()::text);

-- =============================================
-- receipt_items: über JOIN auf receipts
-- =============================================
DROP POLICY IF EXISTS "Allow select receipt_items" ON receipt_items;
DROP POLICY IF EXISTS "Allow insert receipt_items" ON receipt_items;
DROP POLICY IF EXISTS "Allow update receipt_items" ON receipt_items;
DROP POLICY IF EXISTS "Allow delete receipt_items" ON receipt_items;

CREATE POLICY "Users read own receipt_items" ON receipt_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM receipts r WHERE r.receipt_id = receipt_items.receipt_id AND r.user_id = auth.uid()::text)
  );

CREATE POLICY "Users insert own receipt_items" ON receipt_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM receipts r WHERE r.receipt_id = receipt_items.receipt_id AND r.user_id = auth.uid()::text)
  );

CREATE POLICY "Users update own receipt_items" ON receipt_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM receipts r WHERE r.receipt_id = receipt_items.receipt_id AND r.user_id = auth.uid()::text)
  );

CREATE POLICY "Users delete own receipt_items" ON receipt_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM receipts r WHERE r.receipt_id = receipt_items.receipt_id AND r.user_id = auth.uid()::text)
  );

-- =============================================
-- auto_reorder_settings: nur eigene Settings
-- =============================================
DROP POLICY IF EXISTS "Users can read own reorder settings" ON auto_reorder_settings;
DROP POLICY IF EXISTS "Users can insert own reorder settings" ON auto_reorder_settings;
DROP POLICY IF EXISTS "Users can update own reorder settings" ON auto_reorder_settings;
DROP POLICY IF EXISTS "Users can delete own reorder settings" ON auto_reorder_settings;

CREATE POLICY "Users read own reorder settings" ON auto_reorder_settings
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users insert own reorder settings" ON auto_reorder_settings
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users update own reorder settings" ON auto_reorder_settings
  FOR UPDATE USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users delete own reorder settings" ON auto_reorder_settings
  FOR DELETE USING (user_id = auth.uid()::text);

-- =============================================
-- photo_uploads: nur eigene Uploads
-- =============================================
-- INSERT/UPDATE are done via Admin Client (API routes), so only SELECT needs a user policy.
-- Remove the old open policies entirely.
DROP POLICY IF EXISTS "Allow select own photo_uploads" ON photo_uploads;
DROP POLICY IF EXISTS "Allow insert photo_uploads" ON photo_uploads;
DROP POLICY IF EXISTS "Allow update photo_uploads" ON photo_uploads;

CREATE POLICY "Users read own photo_uploads" ON photo_uploads
  FOR SELECT USING (user_id = auth.uid()::text);
