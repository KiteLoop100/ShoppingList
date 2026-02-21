-- Alle Handzettel-Daten löschen (flyer_pages durch CASCADE, products.flyer_id durch SET NULL).
-- Nach dem Löschen zeigt die Ansicht "Handzettel" keine Einträge mehr.
-- Storage-Bucket "flyer-pages" muss ggf. manuell im Supabase Dashboard geleert werden.

DELETE FROM flyers;
