-- F43 Phase 2: Add is_extra_scan flag to list_items
-- Distinguishes items that were on the original shopping list from
-- spontaneously scanned extras added during the Scan & Go flow.
ALTER TABLE list_items
  ADD COLUMN is_extra_scan BOOLEAN NOT NULL DEFAULT false;
