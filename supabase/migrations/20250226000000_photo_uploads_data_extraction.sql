-- photo_type 'data_extraction' für manuelles Produkt anlegen (Datenfotos)
ALTER TABLE photo_uploads DROP CONSTRAINT IF EXISTS photo_uploads_photo_type_check;
ALTER TABLE photo_uploads ADD CONSTRAINT photo_uploads_photo_type_check
  CHECK (photo_type IN ('product_front', 'product_back', 'receipt', 'flyer', 'shelf', 'flyer_pdf', 'data_extraction', 'product_extra'));

-- Verknüpfung Datenfotos/Thumbnails mit Produkt (nach Speichern)
ALTER TABLE photo_uploads ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(product_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_photo_uploads_product ON photo_uploads (product_id) WHERE product_id IS NOT NULL;
