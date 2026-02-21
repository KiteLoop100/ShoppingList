-- F14: Handzettel-Browser – flyers, flyer_pages, products.flyer_id/flyer_page, bucket flyer-pages

-- flyers
CREATE TABLE flyers (
  flyer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  country TEXT NOT NULL CHECK (country IN ('DE', 'AT')),
  pdf_url TEXT,
  total_pages INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_flyers_valid_from ON flyers (valid_from DESC);
CREATE INDEX idx_flyers_status ON flyers (status);

-- flyer_pages
CREATE TABLE flyer_pages (
  page_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flyer_id UUID NOT NULL REFERENCES flyers(flyer_id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK (page_number >= 1),
  image_url TEXT,
  UNIQUE (flyer_id, page_number)
);

CREATE INDEX idx_flyer_pages_flyer ON flyer_pages (flyer_id, page_number);

-- products: optional reference to flyer and page
ALTER TABLE products ADD COLUMN IF NOT EXISTS flyer_id UUID REFERENCES flyers(flyer_id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS flyer_page INTEGER CHECK (flyer_page IS NULL OR flyer_page >= 1);
CREATE INDEX IF NOT EXISTS idx_products_flyer ON products (flyer_id, flyer_page) WHERE flyer_id IS NOT NULL;

-- Storage bucket for page images (public read)
INSERT INTO storage.buckets (id, name, public) VALUES ('flyer-pages', 'flyer-pages', true)
  ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Allow upload flyer-pages" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'flyer-pages');
CREATE POLICY "Allow read flyer-pages" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'flyer-pages');
