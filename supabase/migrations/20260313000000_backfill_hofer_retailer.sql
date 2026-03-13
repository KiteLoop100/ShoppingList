-- Backfill retailer for Austrian Hofer stores that were imported without it.
-- The import script defaulted to the DB column default ('ALDI SÜD').
UPDATE stores
SET retailer = 'Hofer', updated_at = now()
WHERE country = 'AT' AND (retailer = 'ALDI SÜD' OR retailer IS NULL);
