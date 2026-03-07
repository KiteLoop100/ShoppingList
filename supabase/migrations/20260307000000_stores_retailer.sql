-- Add retailer column to stores table for multi-retailer support.
-- Existing stores default to 'ALDI SÜD'; user-created stores will have
-- their retailer set explicitly (e.g. 'REWE', 'EDEKA', 'Lidl').
ALTER TABLE stores ADD COLUMN IF NOT EXISTS retailer TEXT DEFAULT 'ALDI SÜD';

-- Back-fill NZ stores that are clearly not ALDI
UPDATE stores SET retailer = name
WHERE country = 'NZ' AND retailer = 'ALDI SÜD';
