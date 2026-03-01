-- Add separate column for "Sonstige Produktfotos" on competitor products.
-- thumbnail_url = "Foto Produktseite" (front photo, used in list thumbnails)
-- other_photo_url = "Sonstige Produktfotos" (additional photo)
ALTER TABLE competitor_products ADD COLUMN other_photo_url TEXT;
