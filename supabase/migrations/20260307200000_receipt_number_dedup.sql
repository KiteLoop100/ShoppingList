-- Add receipt_number column for deduplication of scanned receipts.
-- The receipt_number (Bonnummer) is extracted by OCR and used to detect
-- duplicate scans. AI will categorize feedback; no manual category needed.

ALTER TABLE receipts ADD COLUMN IF NOT EXISTS receipt_number TEXT DEFAULT NULL;

-- Unique constraint: one receipt per user per receipt_number.
-- Partial index so NULL values are excluded (they can never be "equal" anyway).
CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_user_receipt_number
  ON receipts (user_id, receipt_number)
  WHERE receipt_number IS NOT NULL;

-- General index for fast lookups by receipt_number
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_number
  ON receipts (receipt_number)
  WHERE receipt_number IS NOT NULL;
