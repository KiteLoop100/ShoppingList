-- Multi-retailer receipt scanning: add retailer to receipts, competitor_product_id to receipt_items

-- Normalized retailer identifier on receipts (e.g. "ALDI", "LIDL", "REWE")
ALTER TABLE receipts ADD COLUMN retailer TEXT DEFAULT NULL;

-- Backfill all existing receipts as ALDI (they were all scanned with the ALDI-only prompt)
UPDATE receipts SET retailer = 'ALDI' WHERE retailer IS NULL;

-- FK to competitor_products for non-ALDI receipt items (mutually exclusive with product_id)
ALTER TABLE receipt_items
  ADD COLUMN competitor_product_id UUID DEFAULT NULL
  REFERENCES competitor_products(product_id);

-- Partial index for competitor product lookups on receipt items
CREATE INDEX idx_receipt_items_competitor ON receipt_items(competitor_product_id)
  WHERE competitor_product_id IS NOT NULL;

-- Index for retailer filtering on receipts list page
CREATE INDEX idx_receipts_retailer ON receipts(retailer);
