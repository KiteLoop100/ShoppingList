-- Datenbereinigung: list_items löschen, deren product_id auf kein existierendes Produkt verweist.
-- Im Supabase SQL Editor ausführen oder via: supabase db push
-- Hinweis: „Letzte Einkäufe“ liest aus IndexedDB; diese Bereinigung betrifft nur die Supabase-Tabelle list_items.

DELETE FROM list_items
WHERE product_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.product_id = list_items.product_id
  );
