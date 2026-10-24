-- Enable RLS on tables exposed without policies; drop unused Feb 2026 archive backups.

-- A. Drop manual import archive tables (not used by the app)
DROP TABLE IF EXISTS list_items_archive_20260227;
DROP TABLE IF EXISTS products_archive_20260227;
DROP TABLE IF EXISTS stores_archive_20260227;
DROP TABLE IF EXISTS categories_archive_20260227;

-- B. flyers / flyer_pages: public read, writes via service role only
ALTER TABLE public.flyers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read flyers" ON public.flyers
  FOR SELECT TO authenticated, anon
  USING (true);

ALTER TABLE public.flyer_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read flyer_pages" ON public.flyer_pages
  FOR SELECT TO authenticated, anon
  USING (true);

-- C. pairwise_comparisons: public read (aggregate store layout data)
ALTER TABLE public.pairwise_comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read pairwise_comparisons" ON public.pairwise_comparisons
  FOR SELECT TO authenticated, anon
  USING (true);
