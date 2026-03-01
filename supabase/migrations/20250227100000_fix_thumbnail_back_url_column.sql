-- Fix: Schema-Cache-Fehler "Could not find the 'thumbnail_back-url' Column"
-- Stellt sicher, dass nur die Spalte thumbnail_back_url (Unterstrich) existiert.
-- Falls die Spalte fälschlich mit Bindestrich ("thumbnail_back-url") angelegt wurde, umbenennen;
-- sonst die korrekte Spalte anlegen.

DO $$
BEGIN
  -- Falls Spalte mit Bindestrich existiert (z. B. manuell im Dashboard angelegt): in thumbnail_back_url umbenennen
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'thumbnail_back-url'
  ) THEN
    ALTER TABLE products RENAME COLUMN "thumbnail_back-url" TO thumbnail_back_url;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'thumbnail_back_url'
  ) THEN
    ALTER TABLE products ADD COLUMN thumbnail_back_url TEXT;
  END IF;
END $$;
