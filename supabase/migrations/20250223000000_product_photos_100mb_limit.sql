-- F13: Erhöhe Upload-Limit für Bucket "product-photos" auf 100 MB (für große PDF-Handzettel).
-- Hinweis: Supabase Free Plan erlaubt global max. 50 MB pro Datei – dann 100 MB nicht möglich.
-- Bei Pro/Team: Globales Limit in Project Settings → Storage ggf. anpassen.

-- 100 MB in Bytes
UPDATE storage.buckets
SET file_size_limit = 104857600
WHERE id = 'product-photos';
