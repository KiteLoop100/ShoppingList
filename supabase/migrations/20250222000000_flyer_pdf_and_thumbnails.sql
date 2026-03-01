-- F13: PDF flyer support + product-thumbnails bucket + products.source 'import'
--
-- WICHTIG für PDF-Upload:
-- 1) Der Bucket "product-photos" muss PDF erlauben:
--    Storage → product-photos → ⚙️ Einstellungen → "Allowed MIME types":
--    leer oder image/jpeg, image/png, image/gif, image/webp, application/pdf.
-- 2) Dateigröße: Bis 100 MB pro PDF – Migration 20250223000000 setzt file_size_limit.
--    Free Plan: global max. 50 MB; bei Pro/Team in Project Settings → Storage prüfen.

-- Allow flyer_pdf in photo_uploads.photo_type
ALTER TABLE photo_uploads DROP CONSTRAINT IF EXISTS photo_uploads_photo_type_check;
ALTER TABLE photo_uploads ADD CONSTRAINT photo_uploads_photo_type_check
  CHECK (photo_type IN ('product_front', 'product_back', 'receipt', 'flyer', 'shelf', 'flyer_pdf'));

-- Allow source = 'import' for products (handzettel import)
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_source_check;
ALTER TABLE products ADD CONSTRAINT products_source_check
  CHECK (source IN ('admin', 'crowdsourcing', 'import'));

-- Bucket 'product-thumbnails' for 150x150 product thumbnails (F13)
INSERT INTO storage.buckets (id, name, public) VALUES ('product-thumbnails', 'product-thumbnails', true)
  ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Allow upload product-thumbnails" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'product-thumbnails');
CREATE POLICY "Allow read product-thumbnails" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-thumbnails');
