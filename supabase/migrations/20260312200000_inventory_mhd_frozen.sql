-- Inventory: Add best-before date (MHD), purchase date, and freezer support
-- Feature: Mindesthaltbarkeitsdatum + Gefrierfach-Funktion

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS best_before DATE,
  ADD COLUMN IF NOT EXISTS purchase_date DATE,
  ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS thawed_at TIMESTAMPTZ;

-- Performance index for frozen items lookup
CREATE INDEX IF NOT EXISTS idx_inventory_frozen
  ON inventory_items (user_id, is_frozen)
  WHERE is_frozen = true AND status != 'consumed';

-- Backfill purchase_date from linked receipts for existing items
UPDATE inventory_items inv
SET purchase_date = r.purchase_date::date
FROM receipts r
WHERE inv.source_receipt_id = r.receipt_id
  AND inv.purchase_date IS NULL
  AND r.purchase_date IS NOT NULL;
