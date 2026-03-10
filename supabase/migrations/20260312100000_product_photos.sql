-- Product Photo Management: product_photos table, storage bucket, sync trigger
-- Stores all product photos (thumbnail, product, price_tag) in one normalized table.
-- A DB trigger keeps products.thumbnail_url / competitor_products.thumbnail_url in sync.

-- 1. product_photos table
CREATE TABLE product_photos (
  photo_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID,
  competitor_product_id UUID,
  category     TEXT NOT NULL CHECK (category IN ('thumbnail', 'product', 'price_tag')),
  storage_bucket TEXT NOT NULL,
  storage_path   TEXT NOT NULL,
  public_url     TEXT NOT NULL,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  uploaded_by    UUID REFERENCES auth.users,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_product
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
  CONSTRAINT fk_competitor_product
    FOREIGN KEY (competitor_product_id) REFERENCES competitor_products(product_id) ON DELETE CASCADE,
  CONSTRAINT chk_exactly_one_owner
    CHECK (
      (product_id IS NOT NULL AND competitor_product_id IS NULL) OR
      (product_id IS NULL AND competitor_product_id IS NOT NULL)
    )
);

CREATE INDEX idx_product_photos_product ON product_photos (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_product_photos_competitor ON product_photos (competitor_product_id) WHERE competitor_product_id IS NOT NULL;

-- 2. Enforce max 5 photos per product (DB-level safety net)
CREATE OR REPLACE FUNCTION check_product_photo_limit()
RETURNS TRIGGER AS $$
DECLARE
  photo_count INTEGER;
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    SELECT COUNT(*) INTO photo_count
    FROM product_photos
    WHERE product_id = NEW.product_id;
  ELSE
    SELECT COUNT(*) INTO photo_count
    FROM product_photos
    WHERE competitor_product_id = NEW.competitor_product_id;
  END IF;

  IF photo_count >= 5 THEN
    RAISE EXCEPTION 'Maximum of 5 photos per product reached';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_photo_limit
  BEFORE INSERT ON product_photos
  FOR EACH ROW EXECUTE FUNCTION check_product_photo_limit();

-- 3. Sync thumbnail_url: when a thumbnail-category photo is inserted, updated, or deleted,
--    automatically update the parent product's thumbnail_url column.
--    This replaces all application-level syncThumbnailUrl() calls.
CREATE OR REPLACE FUNCTION sync_thumbnail_url()
RETURNS TRIGGER AS $$
DECLARE
  best_url TEXT;
BEGIN
  -- Determine which product was affected
  IF TG_OP = 'DELETE' THEN
    IF OLD.product_id IS NOT NULL THEN
      SELECT public_url INTO best_url
      FROM product_photos
      WHERE product_id = OLD.product_id AND category = 'thumbnail'
      ORDER BY sort_order ASC, created_at ASC
      LIMIT 1;

      UPDATE products SET thumbnail_url = best_url, updated_at = now()
      WHERE product_id = OLD.product_id;
    END IF;

    IF OLD.competitor_product_id IS NOT NULL THEN
      SELECT public_url INTO best_url
      FROM product_photos
      WHERE competitor_product_id = OLD.competitor_product_id AND category = 'thumbnail'
      ORDER BY sort_order ASC, created_at ASC
      LIMIT 1;

      UPDATE competitor_products SET thumbnail_url = best_url, updated_at = now()
      WHERE product_id = OLD.competitor_product_id;
    END IF;

    RETURN OLD;
  END IF;

  -- INSERT or UPDATE: only act on thumbnail-category photos
  IF NEW.category = 'thumbnail' THEN
    IF NEW.product_id IS NOT NULL THEN
      SELECT public_url INTO best_url
      FROM product_photos
      WHERE product_id = NEW.product_id AND category = 'thumbnail'
      ORDER BY sort_order ASC, created_at ASC
      LIMIT 1;

      UPDATE products SET thumbnail_url = COALESCE(best_url, NEW.public_url), updated_at = now()
      WHERE product_id = NEW.product_id;
    END IF;

    IF NEW.competitor_product_id IS NOT NULL THEN
      SELECT public_url INTO best_url
      FROM product_photos
      WHERE competitor_product_id = NEW.competitor_product_id AND category = 'thumbnail'
      ORDER BY sort_order ASC, created_at ASC
      LIMIT 1;

      UPDATE competitor_products SET thumbnail_url = COALESCE(best_url, NEW.public_url), updated_at = now()
      WHERE product_id = NEW.competitor_product_id;
    END IF;
  END IF;

  -- On DELETE of a thumbnail, also check if we need to clear it
  -- (handled above in DELETE branch)

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_thumbnail_url_trigger
  AFTER INSERT OR UPDATE OR DELETE ON product_photos
  FOR EACH ROW EXECUTE FUNCTION sync_thumbnail_url();

-- 4. RLS policies
ALTER TABLE product_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read product_photos" ON product_photos
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Allow insert product_photos" ON product_photos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update product_photos" ON product_photos
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow delete product_photos" ON product_photos
  FOR DELETE TO authenticated USING (true);

-- 5. Storage bucket for product gallery photos (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-gallery', 'product-gallery', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow upload product-gallery" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-gallery');

CREATE POLICY "Allow read product-gallery" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-gallery');

CREATE POLICY "Allow update product-gallery" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-gallery');

CREATE POLICY "Allow delete product-gallery" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-gallery');

-- 6. Migrate existing photos into product_photos table
-- ALDI products: thumbnail_url → thumbnail category
INSERT INTO product_photos (product_id, category, storage_bucket, storage_path, public_url, sort_order)
SELECT product_id, 'thumbnail', 'product-thumbnails',
  CASE
    WHEN thumbnail_url LIKE '%/storage/v1/object/public/product-thumbnails/%'
    THEN substring(thumbnail_url FROM '/storage/v1/object/public/product-thumbnails/(.+)$')
    ELSE 'migrated/' || product_id || '.jpg'
  END,
  thumbnail_url, 0
FROM products
WHERE thumbnail_url IS NOT NULL AND thumbnail_url != '';

-- ALDI products: thumbnail_back_url → product category
INSERT INTO product_photos (product_id, category, storage_bucket, storage_path, public_url, sort_order)
SELECT product_id, 'product', 'product-thumbnails',
  CASE
    WHEN thumbnail_back_url LIKE '%/storage/v1/object/public/product-thumbnails/%'
    THEN substring(thumbnail_back_url FROM '/storage/v1/object/public/product-thumbnails/(.+)$')
    ELSE 'migrated/back-' || product_id || '.jpg'
  END,
  thumbnail_back_url, 1
FROM products
WHERE thumbnail_back_url IS NOT NULL AND thumbnail_back_url != '';

-- Competitor products: thumbnail_url → thumbnail category
INSERT INTO product_photos (competitor_product_id, category, storage_bucket, storage_path, public_url, sort_order)
SELECT product_id, 'thumbnail', 'competitor-product-photos',
  CASE
    WHEN thumbnail_url LIKE '%/storage/v1/object/public/competitor-product-photos/%'
    THEN substring(thumbnail_url FROM '/storage/v1/object/public/competitor-product-photos/(.+)$')
    ELSE 'migrated/' || product_id || '.jpg'
  END,
  thumbnail_url, 0
FROM competitor_products
WHERE thumbnail_url IS NOT NULL AND thumbnail_url != '';

-- Competitor products: other_photo_url → product category
INSERT INTO product_photos (competitor_product_id, category, storage_bucket, storage_path, public_url, sort_order)
SELECT product_id, 'product', 'competitor-product-photos',
  CASE
    WHEN other_photo_url LIKE '%/storage/v1/object/public/competitor-product-photos/%'
    THEN substring(other_photo_url FROM '/storage/v1/object/public/competitor-product-photos/(.+)$')
    ELSE 'migrated/other-' || product_id || '.jpg'
  END,
  other_photo_url, 1
FROM competitor_products
WHERE other_photo_url IS NOT NULL AND other_photo_url != '';
