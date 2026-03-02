-- Article number normalization: PG function + trigger + index
--
-- Ensures article_number is always stored in a canonical format
-- (digits only, no leading zeros) regardless of import source.
-- Mirrors normalizeArticleNumber() in src/lib/products/normalize.ts.

-- 1. Normalization function (IMMUTABLE for index eligibility)
CREATE OR REPLACE FUNCTION normalize_article_number(raw TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(LTRIM(REGEXP_REPLACE(COALESCE(raw, ''), '\D', '', 'g'), '0'), '');
$$;

-- 2. Trigger function: auto-normalize on every write
CREATE OR REPLACE FUNCTION trg_products_normalize_article_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.article_number := normalize_article_number(NEW.article_number);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_normalize_article_number ON products;
CREATE TRIGGER products_normalize_article_number
  BEFORE INSERT OR UPDATE OF article_number ON products
  FOR EACH ROW
  EXECUTE FUNCTION trg_products_normalize_article_number();

-- 3. Normalize existing data (idempotent — skips already-clean rows)
UPDATE products
SET article_number = normalize_article_number(article_number)
WHERE article_number IS NOT NULL
  AND article_number IS DISTINCT FROM normalize_article_number(article_number);

-- 4. Index for fast lookups (was missing entirely)
CREATE INDEX IF NOT EXISTS idx_products_article_number
  ON products (article_number) WHERE article_number IS NOT NULL;
