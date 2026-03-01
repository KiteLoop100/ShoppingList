-- F13: Foto-Produkterfassung (FEATURES.md F13, DATA-MODEL.md §17)
-- photo_uploads table + products columns + storage bucket policy

-- New table: photo_uploads
CREATE TABLE photo_uploads (
  upload_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  photo_type TEXT CHECK (photo_type IN ('product_front', 'product_back', 'receipt', 'flyer', 'shelf')),
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'completed', 'error')),
  extracted_data JSONB,
  products_created INTEGER NOT NULL DEFAULT 0,
  products_updated INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  pending_thumbnail_overwrites JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_photo_uploads_user_created ON photo_uploads (user_id, created_at DESC);
CREATE INDEX idx_photo_uploads_status ON photo_uploads (status) WHERE status IN ('uploading', 'processing');

-- Products: new columns for F13
ALTER TABLE products ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS photo_source_id UUID REFERENCES photo_uploads(upload_id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS nutrition_info JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ingredients TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS allergens TEXT;

-- RLS: allow anon/authenticated to insert/update photo_uploads (MVP: no password for capture)
ALTER TABLE photo_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert photo_uploads" ON photo_uploads FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "Allow select own photo_uploads" ON photo_uploads FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow update photo_uploads" ON photo_uploads FOR UPDATE TO authenticated, anon USING (true);

-- Realtime for status feed (optional: run if using Supabase Realtime)
-- ALTER PUBLICATION supabase_realtime ADD TABLE photo_uploads;

-- Storage bucket "product-photos" must be created in Supabase Dashboard (Storage → New bucket).
-- Policy: allow anon/authenticated upload and read (for processing and display)
-- Run in SQL or Dashboard:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('product-photos', 'product-photos', true);
-- CREATE POLICY "Allow upload product-photos" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'product-photos');
-- CREATE POLICY "Allow read product-photos" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'product-photos');
