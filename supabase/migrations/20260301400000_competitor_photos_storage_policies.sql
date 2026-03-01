-- Fix: Add missing storage policies for competitor-product-photos bucket.
-- The bucket exists and is public, but had no RLS policies,
-- causing client-side uploads to fail silently.

-- Allow authenticated users to upload competitor product photos
CREATE POLICY "Allow upload competitor-product-photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'competitor-product-photos');

-- Allow public read access (bucket is already public, but explicit SELECT policy needed for RLS)
CREATE POLICY "Allow read competitor-product-photos" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'competitor-product-photos');

-- Allow authenticated users to overwrite their uploads (upsert support)
CREATE POLICY "Allow update competitor-product-photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'competitor-product-photos');
