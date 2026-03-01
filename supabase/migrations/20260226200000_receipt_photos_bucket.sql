-- Migration: Create private receipt-photos bucket with RLS storage policies
-- Security item S1: Receipt photos should not be publicly accessible

-- 1. Create private bucket for receipt photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipt-photos', 'receipt-photos', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage policy: users can read their own receipt photos
-- Path convention: {userId}/{timestamp}_{index}.jpg
CREATE POLICY "Users read own receipt photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'receipt-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Storage policy: users can upload to their own folder
-- Note: The API route uses the admin client for uploads, so this policy
-- is optional but good defense-in-depth for direct client uploads.
CREATE POLICY "Users upload own receipt photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'receipt-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
