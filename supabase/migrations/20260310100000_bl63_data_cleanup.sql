-- Migration: BL-63 data cleanup
--
-- Cleans up legacy string-based demand_sub_group and pairwise_comparisons
-- scope/item values, converting them to the FK code format introduced
-- by the demand_groups schema migration.
--
-- 1. Migrate legacy demand_sub_group strings to FK codes on products
-- 2. NULL out unmapped legacy demand_sub_group values
-- 3. Migrate pairwise_comparisons scope/item values to code format
-- 4. Fix truncated demand_groups name for code '70'

BEGIN;

-- =====================================================================
-- 1. Migrate legacy demand_sub_group strings to FK codes
--    Legacy format: "02-Joghurt, Frucht" → FK code: "51-02"
-- =====================================================================

-- 51-Joghurts/Quark
UPDATE products SET demand_sub_group = '51-02' WHERE demand_group_code = '51' AND demand_sub_group = '02-Joghurt, Frucht';
UPDATE products SET demand_sub_group = '51-04' WHERE demand_group_code = '51' AND demand_sub_group = '04-Quark';
UPDATE products SET demand_sub_group = '51-01' WHERE demand_group_code = '51' AND demand_sub_group = '01-Joghurt, Natur';
UPDATE products SET demand_sub_group = '51-03' WHERE demand_group_code = '51' AND demand_sub_group = '03-Joghurtersatzprodukte';

-- 41-Schokolade/Pralinen
UPDATE products SET demand_sub_group = '41-01' WHERE demand_group_code = '41' AND demand_sub_group = '01-Tafelschokolade';
UPDATE products SET demand_sub_group = '41-02' WHERE demand_group_code = '41' AND demand_sub_group = '02-Schokoriegel';
UPDATE products SET demand_sub_group = '41-03' WHERE demand_group_code = '41' AND demand_sub_group = '03-Pralinen';
UPDATE products SET demand_sub_group = '41-04' WHERE demand_group_code = '41' AND demand_sub_group = '04-Süßwaren mit Schokolade';

-- 84-Käse/Käseersatzprodukte
UPDATE products SET demand_sub_group = '84-09' WHERE demand_group_code = '84' AND demand_sub_group = '09-Käse geschnitten';
UPDATE products SET demand_sub_group = '84-03' WHERE demand_group_code = '84' AND demand_sub_group = '03-Frischkäse';
UPDATE products SET demand_sub_group = '84-02' WHERE demand_group_code = '84' AND demand_sub_group = '02-Weichkäse';
UPDATE products SET demand_sub_group = '84-01' WHERE demand_group_code = '84' AND demand_sub_group = '01-Hart-/Schnittkäse';
UPDATE products SET demand_sub_group = '84-05' WHERE demand_group_code = '84' AND demand_sub_group = '05-Käseerzeugnisse eigener Art';
UPDATE products SET demand_sub_group = '84-07' WHERE demand_group_code = '84' AND demand_sub_group = '07-Käse gerieben/zerkleinert';
UPDATE products SET demand_sub_group = '84-10' WHERE demand_group_code = '84' AND demand_sub_group = '10-Käsesnacks';
UPDATE products SET demand_sub_group = '84-06' WHERE demand_group_code = '84' AND demand_sub_group = '06-Cheddar am Stück';
UPDATE products SET demand_sub_group = '84-04' WHERE demand_group_code = '84' AND demand_sub_group = '04-Schmelzkäse';

-- 69-Gekühlte Wurstwaren
UPDATE products SET demand_sub_group = '69-03' WHERE demand_group_code = '69' AND demand_sub_group = '03-Brühwurst';
UPDATE products SET demand_sub_group = '69-05' WHERE demand_group_code = '69' AND demand_sub_group = '05-Rohwurst';
UPDATE products SET demand_sub_group = '69-06' WHERE demand_group_code = '69' AND demand_sub_group = '06-Würstchen';
UPDATE products SET demand_sub_group = '69-09' WHERE demand_group_code = '69' AND demand_sub_group = '09-Restliche Pökelware';
UPDATE products SET demand_sub_group = '69-08' WHERE demand_group_code = '69' AND demand_sub_group = '08-Schinken roh/gepökelt/luftgetrocknet';
UPDATE products SET demand_sub_group = '69-04' WHERE demand_group_code = '69' AND demand_sub_group = '04-Kochwurst';
UPDATE products SET demand_sub_group = '69-07' WHERE demand_group_code = '69' AND demand_sub_group = '07-Schinken gekocht/gepökelt';
UPDATE products SET demand_sub_group = '69-10' WHERE demand_group_code = '69' AND demand_sub_group = '10-Sonstige Wurst';
UPDATE products SET demand_sub_group = '69-02' WHERE demand_group_code = '69' AND demand_sub_group = '02-Bratwurst';
UPDATE products SET demand_sub_group = '69-01' WHERE demand_group_code = '69' AND demand_sub_group = '01-Aspikware/Sülze';

-- 54-Nährmittel
UPDATE products SET demand_sub_group = '54-02' WHERE demand_group_code = '54' AND demand_sub_group = '02-Teigwaren';
UPDATE products SET demand_sub_group = '54-04' WHERE demand_group_code = '54' AND demand_sub_group = '04-Kräuter/Gewürze/Würzzutaten';
UPDATE products SET demand_sub_group = '54-01' WHERE demand_group_code = '54' AND demand_sub_group = '01-Reis';
UPDATE products SET demand_sub_group = '54-06' WHERE demand_group_code = '54' AND demand_sub_group = '06-Hülsenfrüchte/Getreide';
UPDATE products SET demand_sub_group = '54-03' WHERE demand_group_code = '54' AND demand_sub_group = '03-Kartoffelprodukte';

-- 47-Konserven
UPDATE products SET demand_sub_group = '47-02' WHERE demand_group_code = '47' AND demand_sub_group = '02-Gemüsekonserven';
UPDATE products SET demand_sub_group = '47-03' WHERE demand_group_code = '47' AND demand_sub_group = '03-Sauerkonserven';
UPDATE products SET demand_sub_group = '47-01' WHERE demand_group_code = '47' AND demand_sub_group = '01-Obstkonserven';
UPDATE products SET demand_sub_group = '47-06' WHERE demand_group_code = '47' AND demand_sub_group = '06-Antipasti, ungekühlt';
UPDATE products SET demand_sub_group = '47-04' WHERE demand_group_code = '47' AND demand_sub_group = '04-Pilzkonserven';

-- 03-Wein
UPDATE products SET demand_sub_group = '03-02' WHERE demand_group_code = '03' AND demand_sub_group = '02-Weißwein';
UPDATE products SET demand_sub_group = '03-01' WHERE demand_group_code = '03' AND demand_sub_group = '01-Rotwein';
UPDATE products SET demand_sub_group = '03-03' WHERE demand_group_code = '03' AND demand_sub_group = '03-Roséwein';
UPDATE products SET demand_sub_group = '03-05' WHERE demand_group_code = '03' AND demand_sub_group = '05-Weinhaltige Getränke/Weine, sortiert';
UPDATE products SET demand_sub_group = '03-04' WHERE demand_group_code = '03' AND demand_sub_group = '04-Likör-/Dessertwein';

-- 75-TK Fleisch/Fisch
UPDATE products SET demand_sub_group = '75-01' WHERE demand_group_code = '75' AND demand_sub_group = '01-Fisch/Meeresfrüchte';
UPDATE products SET demand_sub_group = '75-02' WHERE demand_group_code = '75' AND demand_sub_group = '02-Hühnchen';
UPDATE products SET demand_sub_group = '75-04' WHERE demand_group_code = '75' AND demand_sub_group = '04-Schwein';
UPDATE products SET demand_sub_group = '75-10' WHERE demand_group_code = '75' AND demand_sub_group = '10-Fleischersatzprodukte';
UPDATE products SET demand_sub_group = '75-05' WHERE demand_group_code = '75' AND demand_sub_group = '05-Rind';
UPDATE products SET demand_sub_group = '75-07' WHERE demand_group_code = '75' AND demand_sub_group = '07-Sonstige Fleischwaren';

-- 82-Wurst-/Fleisch-/Fischkonserven
UPDATE products SET demand_sub_group = '82-01' WHERE demand_group_code = '82' AND demand_sub_group = '01-Fischkonserven';
UPDATE products SET demand_sub_group = '82-02' WHERE demand_group_code = '82' AND demand_sub_group = '02-Wurst-/Fleischkonserven';

-- 52-Dressings/Öle/Soßen
UPDATE products SET demand_sub_group = '52-04' WHERE demand_group_code = '52' AND demand_sub_group = '04-Soßen/Pesto';
UPDATE products SET demand_sub_group = '52-02' WHERE demand_group_code = '52' AND demand_sub_group = '02-Speiseöle';
UPDATE products SET demand_sub_group = '52-01' WHERE demand_group_code = '52' AND demand_sub_group = '01-Ketchup/Senf';
UPDATE products SET demand_sub_group = '52-05' WHERE demand_group_code = '52' AND demand_sub_group = '05-Essig';
UPDATE products SET demand_sub_group = '52-03' WHERE demand_group_code = '52' AND demand_sub_group = '03-Mayonnaise';
UPDATE products SET demand_sub_group = '52-06' WHERE demand_group_code = '52' AND demand_sub_group = '06-Dressings/Marinaden';
UPDATE products SET demand_sub_group = '52-07' WHERE demand_group_code = '52' AND demand_sub_group = '07-Meerrettich';

-- 78-TK Fertiggerichte/Pizzas
UPDATE products SET demand_sub_group = '78-02' WHERE demand_group_code = '78' AND demand_sub_group = '02-Pizza/Baguettes';
UPDATE products SET demand_sub_group = '78-01' WHERE demand_group_code = '78' AND demand_sub_group = '01-Fertig-/Teilfertiggerichte';
UPDATE products SET demand_sub_group = '78-03' WHERE demand_group_code = '78' AND demand_sub_group = '03-Snacks/Kuchen';

-- 77-TK Desserts/Backwaren/Eis
UPDATE products SET demand_sub_group = '77-02' WHERE demand_group_code = '77' AND demand_sub_group = '02-Eis';
UPDATE products SET demand_sub_group = '77-03' WHERE demand_group_code = '77' AND demand_sub_group = '03-Desserts/Mehlspeisen';
UPDATE products SET demand_sub_group = '77-01' WHERE demand_group_code = '77' AND demand_sub_group = '01-Backwaren';

-- 45-Kaffee/Kakao
UPDATE products SET demand_sub_group = '45-02' WHERE demand_group_code = '45' AND demand_sub_group = '02-Bohnenkaffee';
UPDATE products SET demand_sub_group = '45-05' WHERE demand_group_code = '45' AND demand_sub_group = '05-Kaffeekapseln';
UPDATE products SET demand_sub_group = '45-06' WHERE demand_group_code = '45' AND demand_sub_group = '06-Einzelportionen/Trinkfertig';
UPDATE products SET demand_sub_group = '45-01' WHERE demand_group_code = '45' AND demand_sub_group = '01-Löslicher Kaffee';
UPDATE products SET demand_sub_group = '45-03' WHERE demand_group_code = '45' AND demand_sub_group = '03-Kaffeehaltige Heißgetränke';
UPDATE products SET demand_sub_group = '45-04' WHERE demand_group_code = '45' AND demand_sub_group = '04-Pulvergetränke';

-- 90-Cerealien/Snacks
UPDATE products SET demand_sub_group = '90-01' WHERE demand_group_code = '90' AND demand_sub_group = '01-Cerealien';
UPDATE products SET demand_sub_group = '90-03' WHERE demand_group_code = '90' AND demand_sub_group = '03-Snack-/Energie-/Müsliriegel';
UPDATE products SET demand_sub_group = '90-01' WHERE demand_group_code = '90' AND demand_sub_group = '02-Warme Cerealien/Haferbrei';

-- 72-Gekühlte Fertiggerichte
UPDATE products SET demand_sub_group = '72-04' WHERE demand_group_code = '72' AND demand_sub_group = '04-Teigwaren';
UPDATE products SET demand_sub_group = '72-01' WHERE demand_group_code = '72' AND demand_sub_group = '01-Fertiggerichte';
UPDATE products SET demand_sub_group = '72-05' WHERE demand_group_code = '72' AND demand_sub_group = '05-Backwaren';
UPDATE products SET demand_sub_group = '72-03' WHERE demand_group_code = '72' AND demand_sub_group = '03-Kartoffelprodukte';
UPDATE products SET demand_sub_group = '72-02' WHERE demand_group_code = '72' AND demand_sub_group = '02-Pizza';

-- 89-Backartikel
UPDATE products SET demand_sub_group = '89-02' WHERE demand_group_code = '89' AND demand_sub_group = '02-Backzutaten';
UPDATE products SET demand_sub_group = '89-01' WHERE demand_group_code = '89' AND demand_sub_group = '01-Mehl';
UPDATE products SET demand_sub_group = '89-03' WHERE demand_group_code = '89' AND demand_sub_group = '03-Zucker/Süßungsmittel';
UPDATE products SET demand_sub_group = '89-04' WHERE demand_group_code = '89' AND demand_sub_group = '04-Dessertpulver';
UPDATE products SET demand_sub_group = '89-05' WHERE demand_group_code = '89' AND demand_sub_group = '05-Backmischungen';

-- 76-TK Obst/Gemüse
UPDATE products SET demand_sub_group = '76-01' WHERE demand_group_code = '76' AND demand_sub_group = '01-Gemüse';
UPDATE products SET demand_sub_group = '76-02' WHERE demand_group_code = '76' AND demand_sub_group = '02-Kartoffelprodukte';
UPDATE products SET demand_sub_group = '76-03' WHERE demand_group_code = '76' AND demand_sub_group = '03-Obst';

-- 83-Milch/Sahne/Butter
UPDATE products SET demand_sub_group = '83-01' WHERE demand_group_code = '83' AND demand_sub_group = '01-Milchgetränke';
UPDATE products SET demand_sub_group = '83-03' WHERE demand_group_code = '83' AND demand_sub_group = '03-Sahne';
UPDATE products SET demand_sub_group = '83-02' WHERE demand_group_code = '83' AND demand_sub_group = '02-Milch';
UPDATE products SET demand_sub_group = '83-04' WHERE demand_group_code = '83' AND demand_sub_group = '04-Butter/tierische Fette';

-- 57-Brot/Kuchen
UPDATE products SET demand_sub_group = '57-05' WHERE demand_group_code = '57' AND demand_sub_group = '05-Haltbare Feinbackwaren';
UPDATE products SET demand_sub_group = '57-02' WHERE demand_group_code = '57' AND demand_sub_group = '02-Frischbrot';
UPDATE products SET demand_sub_group = '57-01' WHERE demand_group_code = '57' AND demand_sub_group = '01-Aufbackartikel';
UPDATE products SET demand_sub_group = '57-03' WHERE demand_group_code = '57' AND demand_sub_group = '03-Frische Feinbackwaren';
UPDATE products SET demand_sub_group = '57-06' WHERE demand_group_code = '57' AND demand_sub_group = '06-Haltbarer Kuchen';
UPDATE products SET demand_sub_group = '57-10' WHERE demand_group_code = '57' AND demand_sub_group = '10-Alternativen zum Sandwich';
UPDATE products SET demand_sub_group = '57-07' WHERE demand_group_code = '57' AND demand_sub_group = '07-Haltbares Brot';
UPDATE products SET demand_sub_group = '57-12' WHERE demand_group_code = '57' AND demand_sub_group = '12-Kleingebäck';
UPDATE products SET demand_sub_group = '57-09' WHERE demand_group_code = '57' AND demand_sub_group = '09-Brötchen/Semmeln';
UPDATE products SET demand_sub_group = '57-04' WHERE demand_group_code = '57' AND demand_sub_group = '04-Frische Kleinbackwaren';
UPDATE products SET demand_sub_group = '57-11' WHERE demand_group_code = '57' AND demand_sub_group = '11-Frischer Kuchen';

-- 01-Spirituosen
UPDATE products SET demand_sub_group = '01-01' WHERE demand_group_code = '01' AND demand_sub_group = '01-Spirituosen';
UPDATE products SET demand_sub_group = '01-02' WHERE demand_group_code = '01' AND demand_sub_group = '02-Liköre/Bitter';
UPDATE products SET demand_sub_group = '01-03' WHERE demand_group_code = '01' AND demand_sub_group = '03-Mixgetränke';

-- 73-Gekühlte Feinkost
UPDATE products SET demand_sub_group = '73-04' WHERE demand_group_code = '73' AND demand_sub_group = '04-Salat, verzehrfertig';
UPDATE products SET demand_sub_group = '73-02' WHERE demand_group_code = '73' AND demand_sub_group = '02-Aufstriche/Dips/Dressings';
UPDATE products SET demand_sub_group = '73-07' WHERE demand_group_code = '73' AND demand_sub_group = '07-Desserts';
UPDATE products SET demand_sub_group = '73-01' WHERE demand_group_code = '73' AND demand_sub_group = '01-Feinkost';
UPDATE products SET demand_sub_group = '73-06' WHERE demand_group_code = '73' AND demand_sub_group = '06-Sandwiches/Snacks';

-- 56-Bake-Off
UPDATE products SET demand_sub_group = '56-06' WHERE demand_group_code = '56' AND demand_sub_group = '06-Brötchen/Semmeln';
UPDATE products SET demand_sub_group = '56-05' WHERE demand_group_code = '56' AND demand_sub_group = '05-Feinbackwaren';
UPDATE products SET demand_sub_group = '56-02' WHERE demand_group_code = '56' AND demand_sub_group = '02-Schwarz-/Vollkornbrot';
UPDATE products SET demand_sub_group = '56-04' WHERE demand_group_code = '56' AND demand_sub_group = '04-Pikante Snacks';
UPDATE products SET demand_sub_group = '56-03' WHERE demand_group_code = '56' AND demand_sub_group = '03-Spezialbrot';
UPDATE products SET demand_sub_group = '56-01' WHERE demand_group_code = '56' AND demand_sub_group = '01-Weißbrot';

-- 48-Fertiggerichte/Suppen
UPDATE products SET demand_sub_group = '48-05' WHERE demand_group_code = '48' AND demand_sub_group = '05-Trockensuppen/Fixprodukte/trockene Suppe';
UPDATE products SET demand_sub_group = '48-04' WHERE demand_group_code = '48' AND demand_sub_group = '04-Instantgerichte';
UPDATE products SET demand_sub_group = '48-02' WHERE demand_group_code = '48' AND demand_sub_group = '02-Eintöpfe/Nasssuppen';
UPDATE products SET demand_sub_group = '48-01' WHERE demand_group_code = '48' AND demand_sub_group = '01-Fertiggerichte';

-- 58-Obst
UPDATE products SET demand_sub_group = '58-01' WHERE demand_group_code = '58' AND demand_sub_group = '01-Äpfel';
UPDATE products SET demand_sub_group = '58-06' WHERE demand_group_code = '58' AND demand_sub_group = '06-Zitrusfrüchte';
UPDATE products SET demand_sub_group = '58-04' WHERE demand_group_code = '58' AND demand_sub_group = '04-Beeren';
UPDATE products SET demand_sub_group = '58-07' WHERE demand_group_code = '58' AND demand_sub_group = '07-Exotische Früchte';
UPDATE products SET demand_sub_group = '58-05' WHERE demand_group_code = '58' AND demand_sub_group = '05-Trauben';
UPDATE products SET demand_sub_group = '58-12' WHERE demand_group_code = '58' AND demand_sub_group = '12-Avocados';
UPDATE products SET demand_sub_group = '58-02' WHERE demand_group_code = '58' AND demand_sub_group = '02-Birnen';
UPDATE products SET demand_sub_group = '58-08' WHERE demand_group_code = '58' AND demand_sub_group = '08-Bananen';
UPDATE products SET demand_sub_group = '58-10' WHERE demand_group_code = '58' AND demand_sub_group = '10-Melonen';
UPDATE products SET demand_sub_group = '58-03' WHERE demand_group_code = '58' AND demand_sub_group = '03-Steinobst';
UPDATE products SET demand_sub_group = '58-11' WHERE demand_group_code = '58' AND demand_sub_group = '11-Mangos';
UPDATE products SET demand_sub_group = '58-15' WHERE demand_group_code = '58' AND demand_sub_group = '15-Snacks/Obst, verzehrfertig';

-- 38-Gemüse
UPDATE products SET demand_sub_group = '38-07' WHERE demand_group_code = '38' AND demand_sub_group = '07-Zwiebelgemüse';
UPDATE products SET demand_sub_group = '38-05' WHERE demand_group_code = '38' AND demand_sub_group = '05-Wurzel-/Knollengemüse';
UPDATE products SET demand_sub_group = '38-03' WHERE demand_group_code = '38' AND demand_sub_group = '03-Tomaten';
UPDATE products SET demand_sub_group = '38-06' WHERE demand_group_code = '38' AND demand_sub_group = '06-Kartoffeln';
UPDATE products SET demand_sub_group = '38-04' WHERE demand_group_code = '38' AND demand_sub_group = '04-Kohlgemüse';
UPDATE products SET demand_sub_group = '38-02' WHERE demand_group_code = '38' AND demand_sub_group = '02-Paprika';
UPDATE products SET demand_sub_group = '38-08' WHERE demand_group_code = '38' AND demand_sub_group = '08-Pilze';
UPDATE products SET demand_sub_group = '38-16' WHERE demand_group_code = '38' AND demand_sub_group = '16-Sonstiges Gemüse';
UPDATE products SET demand_sub_group = '38-13' WHERE demand_group_code = '38' AND demand_sub_group = '13-Frische Kräuter';
UPDATE products SET demand_sub_group = '38-17' WHERE demand_group_code = '38' AND demand_sub_group = '17-Snacks/Gemüse, verzehrfertig';
UPDATE products SET demand_sub_group = '38-01' WHERE demand_group_code = '38' AND demand_sub_group = '01-Gemüse (hart)';
UPDATE products SET demand_sub_group = '38-09' WHERE demand_group_code = '38' AND demand_sub_group = '09-Hülsenfrüchte';
UPDATE products SET demand_sub_group = '38-11' WHERE demand_group_code = '38' AND demand_sub_group = '11-Zucchini';
UPDATE products SET demand_sub_group = '38-10' WHERE demand_group_code = '38' AND demand_sub_group = '10-Kürbisse';
UPDATE products SET demand_sub_group = '38-12' WHERE demand_group_code = '38' AND demand_sub_group = '12-Spargel';

-- 50-H-Milchprodukte/Milchersatzprodukte
UPDATE products SET demand_sub_group = '50-02' WHERE demand_group_code = '50' AND demand_sub_group = '02-H-Milch';
UPDATE products SET demand_sub_group = '50-01' WHERE demand_group_code = '50' AND demand_sub_group = '01-H-Käse';
UPDATE products SET demand_sub_group = '50-04' WHERE demand_group_code = '50' AND demand_sub_group = '04-Milchersatzprodukte';
UPDATE products SET demand_sub_group = '50-03' WHERE demand_group_code = '50' AND demand_sub_group = '03-H-Sahne';

-- 53-Konfitüren/Brotaufstriche
UPDATE products SET demand_sub_group = '53-01' WHERE demand_group_code = '53' AND demand_sub_group = '01-Fruchtaufstriche';
UPDATE products SET demand_sub_group = '53-02' WHERE demand_group_code = '53' AND demand_sub_group = '02-Honig';
UPDATE products SET demand_sub_group = '53-04' WHERE demand_group_code = '53' AND demand_sub_group = '04-Nussaufstriche';
UPDATE products SET demand_sub_group = '53-06' WHERE demand_group_code = '53' AND demand_sub_group = '06-Süße Aufstriche';
UPDATE products SET demand_sub_group = '53-03' WHERE demand_group_code = '53' AND demand_sub_group = '03-Sirup/Garnierung';
UPDATE products SET demand_sub_group = '53-05' WHERE demand_group_code = '53' AND demand_sub_group = '05-Herzhafte Aufstriche';

-- =====================================================================
-- 2. NULL out unmapped legacy demand_sub_group values
--    Products in demand groups without sub-groups defined in the
--    demand_sub_groups table still have legacy strings; set to NULL.
-- =====================================================================
UPDATE products SET demand_sub_group = NULL
WHERE demand_sub_group IS NOT NULL
  AND demand_sub_group != ''
  AND demand_sub_group !~ '^\d+-\d+$';

-- =====================================================================
-- 3. Migrate pairwise_comparisons scope and item values
-- =====================================================================

-- 3a. Level "subgroup": scope "38-Gemüse" → "38"
UPDATE pairwise_comparisons
SET scope = regexp_replace(scope, '-.*', '')
WHERE level = 'subgroup' AND scope IS NOT NULL AND scope ~ '^\d+-';

-- 3b. Level "product": scope "83-Milch/Sahne/Butter|02-Milch" → "83|83-02"
UPDATE pairwise_comparisons
SET scope = regexp_replace(scope, '^(\d+)-[^|]+\|(\d+)-.*$', '\1|\1-\2')
WHERE level = 'product' AND scope IS NOT NULL AND scope ~ '^\d+-[^|]+\|\d+-';

-- 3c. Level "group": item_a/item_b "83-Milch/Sahne/Butter" → "83"
UPDATE pairwise_comparisons
SET item_a = regexp_replace(item_a, '-.*', ''),
    item_b = regexp_replace(item_b, '-.*', '')
WHERE level = 'group' AND item_a ~ '^\d+-';

-- =====================================================================
-- 4. Fix truncated demand_groups name
-- =====================================================================
UPDATE demand_groups SET name = 'Fertigfleisch/-wurst, gekühlt' WHERE code = '70';

COMMIT;
