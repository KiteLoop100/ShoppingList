-- ============================================================================
-- Phase 1: product_photos table, triggers, RLS, storage bucket, data migration
-- ============================================================================

-- 1a. New table: product_photos
CREATE TABLE product_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(product_id) ON DELETE CASCADE,
  competitor_product_id UUID REFERENCES competitor_products(product_id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('thumbnail', 'product', 'price_tag')),
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exactly_one_product CHECK (
    (product_id IS NOT NULL)::int + (competitor_product_id IS NOT NULL)::int = 1
  )
);

-- Partial unique indices: max 1 thumbnail, max 1 price_tag per product
CREATE UNIQUE INDEX uq_pp_thumb_aldi ON product_photos (product_id)
  WHERE category = 'thumbnail' AND product_id IS NOT NULL;
CREATE UNIQUE INDEX uq_pp_thumb_comp ON product_photos (competitor_product_id)
  WHERE category = 'thumbnail' AND competitor_product_id IS NOT NULL;
CREATE UNIQUE INDEX uq_pp_price_aldi ON product_photos (product_id)
  WHERE category = 'price_tag' AND product_id IS NOT NULL;
CREATE UNIQUE INDEX uq_pp_price_comp ON product_photos (competitor_product_id)
  WHERE category = 'price_tag' AND competitor_product_id IS NOT NULL;

-- Lookup indices
CREATE INDEX idx_pp_aldi ON product_photos (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_pp_comp ON product_photos (competitor_product_id) WHERE competitor_product_id IS NOT NULL;

-- 5-photo limit trigger
CREATE OR REPLACE FUNCTION check_product_photo_limit() RETURNS TRIGGER AS $$
DECLARE photo_count INT;
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    SELECT COUNT(*) INTO photo_count FROM product_photos WHERE product_id = NEW.product_id;
  ELSE
    SELECT COUNT(*) INTO photo_count FROM product_photos WHERE competitor_product_id = NEW.competitor_product_id;
  END IF;
  IF photo_count >= 5 THEN
    RAISE EXCEPTION 'Maximal 5 Fotos pro Produkt erlaubt';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_product_photo_limit BEFORE INSERT ON product_photos
  FOR EACH ROW EXECUTE FUNCTION check_product_photo_limit();

-- 1b. Thumbnail sync trigger (replaces all manual syncThumbnailUrl calls)
CREATE OR REPLACE FUNCTION sync_thumbnail_url_trigger() RETURNS TRIGGER AS $$
DECLARE
  target_product_id UUID;
  target_competitor_id UUID;
  thumb_url TEXT;
BEGIN
  target_product_id := COALESCE(NEW.product_id, OLD.product_id);
  target_competitor_id := COALESCE(NEW.competitor_product_id, OLD.competitor_product_id);

  IF target_product_id IS NOT NULL THEN
    SELECT photo_url INTO thumb_url FROM product_photos
      WHERE product_id = target_product_id AND category = 'thumbnail' LIMIT 1;
    UPDATE products SET thumbnail_url = thumb_url
      WHERE product_id = target_product_id;
  END IF;

  IF target_competitor_id IS NOT NULL THEN
    SELECT photo_url INTO thumb_url FROM product_photos
      WHERE competitor_product_id = target_competitor_id AND category = 'thumbnail' LIMIT 1;
    UPDATE competitor_products SET thumbnail_url = thumb_url
      WHERE product_id = target_competitor_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_thumbnail
  AFTER INSERT OR UPDATE OR DELETE ON product_photos
  FOR EACH ROW EXECUTE FUNCTION sync_thumbnail_url_trigger();

-- 1c. RLS policies
ALTER TABLE product_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read product_photos" ON product_photos
  FOR SELECT TO anon, authenticated USING (true);

-- Write access: authenticated only.
-- No user_id filter because products/competitor_products also lack ownership.
-- Acceptable risk for a small-user, closed app.
CREATE POLICY "Auth insert product_photos" ON product_photos
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update product_photos" ON product_photos
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete product_photos" ON product_photos
  FOR DELETE TO authenticated USING (true);

-- 1d. New storage bucket: product-gallery
INSERT INTO storage.buckets (id, name, public)
  VALUES ('product-gallery', 'product-gallery', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth upload product-gallery" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-gallery');
CREATE POLICY "Public read product-gallery" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'product-gallery');
CREATE POLICY "Auth update product-gallery" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'product-gallery');
CREATE POLICY "Auth delete product-gallery" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'product-gallery');

-- 1e. Data migration: copy existing photos into product_photos

-- ALDI thumbnails
INSERT INTO product_photos (product_id, photo_url, storage_bucket, storage_path, category, sort_order)
SELECT product_id, thumbnail_url,
  'product-thumbnails',
  regexp_replace(thumbnail_url, '^.*/product-thumbnails/', ''),
  'thumbnail', 0
FROM products WHERE thumbnail_url IS NOT NULL
ON CONFLICT DO NOTHING;

-- ALDI back photos
INSERT INTO product_photos (product_id, photo_url, storage_bucket, storage_path, category, sort_order)
SELECT product_id, thumbnail_back_url,
  'product-thumbnails',
  regexp_replace(thumbnail_back_url, '^.*/product-thumbnails/', ''),
  'product', 1
FROM products WHERE thumbnail_back_url IS NOT NULL
ON CONFLICT DO NOTHING;

-- Competitor thumbnails
INSERT INTO product_photos (competitor_product_id, photo_url, storage_bucket, storage_path, category, sort_order)
SELECT product_id, thumbnail_url,
  'competitor-product-photos',
  regexp_replace(thumbnail_url, '^.*/competitor-product-photos/', ''),
  'thumbnail', 0
FROM competitor_products WHERE thumbnail_url IS NOT NULL
ON CONFLICT DO NOTHING;

-- Competitor other photos
INSERT INTO product_photos (competitor_product_id, photo_url, storage_bucket, storage_path, category, sort_order)
SELECT product_id, other_photo_url,
  'competitor-product-photos',
  regexp_replace(other_photo_url, '^.*/competitor-product-photos/', ''),
  'product', 1
FROM competitor_products WHERE other_photo_url IS NOT NULL
ON CONFLICT DO NOTHING;
