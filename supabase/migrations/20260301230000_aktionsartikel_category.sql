-- Add "Aktionsartikel" category for promotional flyer products
INSERT INTO categories (name, name_translations, icon, default_sort_position)
VALUES (
  'Aktionsartikel',
  '{"de": "Aktionsartikel", "en": "Promotional Items"}'::jsonb,
  '🏷️',
  90
)
ON CONFLICT DO NOTHING;
