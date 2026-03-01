-- BL-21: Restrict storage upload policies for product-thumbnails and flyer-pages.
-- Uploads happen via API routes using the service-role admin client,
-- so anon/authenticated INSERT policies are not needed.
-- Public SELECT (read) policies remain unchanged.

-- ── product-thumbnails: remove open INSERT policy ──
DROP POLICY IF EXISTS "Allow upload product-thumbnails" ON storage.objects;

-- Only service_role (admin client) can upload.
-- Create a restrictive policy that blocks all direct client uploads:
CREATE POLICY "Deny direct upload product-thumbnails" ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'product-thumbnails' AND false);

-- ── flyer-pages: remove open INSERT policy ──
DROP POLICY IF EXISTS "Allow upload flyer-pages" ON storage.objects;

-- Only service_role (admin client) can upload.
CREATE POLICY "Deny direct upload flyer-pages" ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'flyer-pages' AND false);
