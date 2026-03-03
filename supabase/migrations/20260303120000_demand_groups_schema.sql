-- Migration: demand_groups schema and seed data
--
-- Replaces the old UUID-based `categories` table with a code-based
-- `demand_groups` + `demand_sub_groups` system matching ALDI's ~61
-- commodity group codes (e.g. "01" = Spirituosen, "83" = Milch/Sahne/Butter).
--
-- The old `categories` table and `category_id` columns are NOT dropped here;
-- that cleanup happens after the frontend is migrated.

-- =====================================================================
-- 1. demand_groups table
-- =====================================================================
CREATE TABLE demand_groups (
  code            TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  name_en         TEXT,
  icon            TEXT,
  color           TEXT,
  sort_position   INTEGER NOT NULL DEFAULT 999,
  parent_group    TEXT REFERENCES demand_groups(code),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 2. demand_sub_groups table
-- =====================================================================
CREATE TABLE demand_sub_groups (
  code              TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  name_en           TEXT,
  demand_group_code TEXT NOT NULL REFERENCES demand_groups(code),
  sort_position     INTEGER NOT NULL DEFAULT 999
);

-- =====================================================================
-- 3. Seed demand_groups
-- =====================================================================
INSERT INTO demand_groups (code, name, name_en, icon, color, sort_position) VALUES
  -- Alcohol
  ('01', 'Spirituosen',                              'Spirits',                        '🥃', '#5E35B1',  1),
  ('02', 'Sekt/Schaumwein',                          'Sparkling Wine',                 '🥂', '#AD1457',  2),
  ('03', 'Wein',                                     'Wine',                           '🍷', '#880E4F',  3),
  ('04', 'Bier',                                     'Beer',                           '🍺', '#2E7D32',  4),

  -- Non-alcoholic beverages
  ('05', 'Wasser',                                   'Water',                          '💧', '#1976D2',  5),
  ('79', 'Funktionsgetränke/Eistee',                 'Functional Drinks / Iced Tea',   '🧃', '#2196F3',  6),
  ('80', 'Erfrischungsgetränke',                     'Soft Drinks',                    '🥤', '#1565C0',  7),
  ('81', 'Fruchtsäfte/Sirupe',                       'Juices / Syrups',                '🧃', '#0D47A1',  8),

  -- Health, beauty, baby
  ('07', 'Kosmetik/Körperpflege',                    'Cosmetics / Personal Care',      '💄', '#E91E63',  9),
  ('08', 'Körperhygiene',                            'Body Hygiene',                   '🧴', '#D81B60', 10),
  ('09', 'Babyartikel',                              'Baby Products',                  '👶', '#EC407A', 11),
  ('13', 'Apothekenprodukte',                        'Pharmacy Products',              '💊', '#C2185B', 12),

  -- Household / cleaning
  ('06', 'Wasch-/Putz-/Reinigungsmittel',            'Cleaning Products',              '🧹', '#607080', 13),
  ('10', 'Papierwaren',                              'Paper Products',                 '🧻', '#7890A0', 14),
  ('11', 'Folien/Tücher',                            'Foil / Cloths',                  '🧽', '#5A7088', 15),
  ('25', 'Haushaltsartikel',                         'Household Items',                '🏠', '#708090', 16),

  -- Fruits & vegetables
  ('38', 'Gemüse',                                   'Vegetables',                     '🥦', '#1DB954', 17),
  ('58', 'Obst',                                     'Fruit',                          '🍎', '#28A745', 18),
  ('88', 'Salate',                                   'Salads',                         '🥗', '#15A040', 19),

  -- Snacking / sweets
  ('40', 'Bonbons/Kaugummi',                         'Candy / Chewing Gum',            '🍬', '#F4511E', 20),
  ('41', 'Schokolade/Pralinen',                      'Chocolate / Pralines',           '🍫', '#D84315', 21),
  ('42', 'Gebäck',                                   'Biscuits / Cookies',             '🍪', '#E65100', 22),
  ('43', 'Saisonartikel Süßwaren',                   'Seasonal Sweets',                '🎄', '#BF360C', 23),
  ('44', 'Salzgebäck',                               'Salty Snacks',                   '🥨', '#E64A19', 24),
  ('86', 'Chips/Snacks',                             'Chips / Snacks',                 '🍿', '#C43E00', 25),
  ('87', 'Nüsse/Trockenfrüchte',                     'Nuts / Dried Fruit',             '🥜', '#A84000', 26),

  -- Coffee & tea
  ('45', 'Kaffee/Kakao',                             'Coffee / Cocoa',                 '☕', '#8B5E3C', 27),
  ('46', 'Tee',                                      'Tea',                            '🍵', '#7D5230', 28),

  -- Pantry / dry goods
  ('47', 'Konserven',                                'Canned Goods',                   '🥫', '#986040', 29),
  ('48', 'Fertiggerichte/Suppen',                    'Ready Meals / Soups',            '🍜', '#B08058', 30),
  ('49', 'Dauerwurst/Speck',                         'Cured Sausage / Bacon',          '🥓', '#B04050', 31),
  ('50', 'H-Milchprodukte/Milchersatzprodukte',      'UHT Dairy / Dairy Alternatives', '🥛', '#1565C0', 32),
  ('51', 'Joghurts/Quark',                           'Yoghurt / Quark',                '🥄', '#1E88E5', 33),
  ('52', 'Dressings/Öle/Soßen',                      'Dressings / Oils / Sauces',      '🫒', '#AA7850', 34),
  ('53', 'Konfitüren/Brotaufstriche',                'Jams / Spreads',                 '🍯', '#8C5C38', 35),
  ('54', 'Nährmittel',                               'Staples (Pasta, Rice, Spices)',   '🍝', '#A07048', 36),
  ('55', 'Eier',                                     'Eggs',                           '🥚', '#C49520', 37),

  -- Bakery
  ('56', 'Bake-Off',                                 'Bake-Off (In-Store Bakery)',      '🥐', '#E8A817', 38),
  ('57', 'Brot/Kuchen',                              'Bread / Cake',                   '🍞', '#D4960F', 39),

  -- Dairy
  ('60', 'Margarine/pflanzliche Fette',              'Margarine / Plant Fats',         '🧈', '#1976D2', 40),
  ('83', 'Milch/Sahne/Butter',                       'Milk / Cream / Butter',          '🥛', '#2196F3', 41),
  ('84', 'Käse/Käseersatzprodukte',                  'Cheese',                         '🧀', '#42A5F5', 42),

  -- Fresh meat & fish
  ('62', 'Frischfleisch (ohne Schwein/Geflügel)',    'Fresh Meat (excl. Pork/Poultry)','🥩', '#EF5350', 43),
  ('64', 'Fisch, frisch',                            'Fresh Fish',                     '🐟', '#C62828', 44),
  ('67', 'Geflügel, frisch',                         'Fresh Poultry',                  '🍗', '#D32F2F', 45),
  ('68', 'Schweinefleisch, frisch',                  'Fresh Pork',                     '🥩', '#E53935', 46),

  -- Chilled meat / sausage
  ('69', 'Gekühlte Wurstwaren',                      'Chilled Cold Cuts',              '🥓', '#C04858', 47),
  ('70', 'Gekühltes verzehrfertiges Fleisch/Fleisc', 'Chilled Ready-to-Eat Meat',      '🍖', '#D05060', 48),
  ('82', 'Wurst-/Fleisch-/Fischkonserven',           'Canned Meat / Fish',             '🥫', '#A83848', 49),

  -- Chilled convenience
  ('71', 'Gekühlter verzehrfertiger Fisch',          'Chilled Ready-to-Eat Fish',      '🐟', '#00838F', 50),
  ('72', 'Gekühlte Fertiggerichte',                  'Chilled Ready Meals',            '🍱', '#0097A7', 51),
  ('73', 'Gekühlte Feinkost',                        'Chilled Deli',                   '🥙', '#00ACC1', 52),
  ('74', 'Gekühlte Getränke',                        'Chilled Beverages',              '🧊', '#00BCD4', 53),

  -- Frozen
  ('75', 'TK Fleisch/Fisch',                         'Frozen Meat / Fish',             '🧊', '#5C8DAE', 54),
  ('76', 'TK Obst/Gemüse',                           'Frozen Fruit / Vegetables',      '🥶', '#6E9DBE', 55),
  ('77', 'TK Desserts/Backwaren/Eis',                'Frozen Desserts / Ice Cream',    '🍦', '#5490B0', 56),
  ('78', 'TK Fertiggerichte/Pizzas',                 'Frozen Ready Meals / Pizza',     '🍕', '#4A7D9E', 57),

  -- Pet food
  ('85', 'Tiernahrung',                              'Pet Food',                       '🐾', '#506878', 58),

  -- Baking / cereals
  ('89', 'Backartikel',                              'Baking Supplies',                '🧁', '#C08A0A', 59),
  ('90', 'Cerealien/Snacks',                         'Cereals / Snack Bars',           '🥣', '#946640', 60),

  -- Promotional
  ('AK', 'Aktionsartikel',                           'Promotional Items',              '🏷️', '#0050A0', 61);

-- =====================================================================
-- 4. Seed demand_sub_groups
--    Codes are composite: demand_group_code || '-' || sub_code
-- =====================================================================
INSERT INTO demand_sub_groups (code, name, demand_group_code, sort_position) VALUES
  -- 56-Bake-Off
  ('56-06', 'Brötchen/Semmeln',                  '56',  1),
  ('56-01', 'Weißbrot',                           '56',  2),
  ('56-02', 'Schwarz-/Vollkornbrot',              '56',  3),
  ('56-03', 'Spezialbrot',                        '56',  4),
  ('56-05', 'Feinbackwaren',                      '56',  5),
  ('56-04', 'Pikante Snacks',                     '56',  6),

  -- 57-Brot/Kuchen
  ('57-02', 'Frischbrot',                         '57',  1),
  ('57-09', 'Brötchen/Semmeln',                   '57',  2),
  ('57-07', 'Haltbares Brot',                     '57',  3),
  ('57-10', 'Alternativen zum Sandwich',           '57',  4),
  ('57-12', 'Kleingebäck',                        '57',  5),
  ('57-03', 'Frische Feinbackwaren',               '57',  6),
  ('57-04', 'Frische Kleinbackwaren',              '57',  7),
  ('57-11', 'Frischer Kuchen',                     '57',  8),
  ('57-05', 'Haltbare Feinbackwaren',              '57',  9),
  ('57-06', 'Haltbarer Kuchen',                    '57', 10),
  ('57-01', 'Aufbackartikel',                      '57', 11),

  -- 73-Gekühlte Feinkost
  ('73-04', 'Salat, verzehrfertig',                '73',  1),
  ('73-01', 'Feinkost',                            '73',  2),
  ('73-06', 'Sandwiches/Snacks',                   '73',  3),
  ('73-02', 'Aufstriche/Dips/Dressings',           '73',  4),
  ('73-07', 'Desserts',                            '73',  5),

  -- 69-Gekühlte Wurstwaren
  ('69-06', 'Würstchen',                           '69',  1),
  ('69-02', 'Bratwurst',                           '69',  2),
  ('69-03', 'Brühwurst',                           '69',  3),
  ('69-05', 'Rohwurst',                            '69',  4),
  ('69-07', 'Schinken gekocht/gepökelt',           '69',  5),
  ('69-08', 'Schinken roh/gepökelt/luftgetrocknet','69',  6),
  ('69-09', 'Restliche Pökelware',                 '69',  7),
  ('69-04', 'Kochwurst',                           '69',  8),
  ('69-10', 'Sonstige Wurst',                      '69',  9),
  ('69-01', 'Aspikware/Sülze',                     '69', 10),

  -- 83-Milch/Sahne/Butter
  ('83-02', 'Milch',                               '83',  1),
  ('83-01', 'Milchgetränke',                       '83',  2),
  ('83-03', 'Sahne',                               '83',  3),
  ('83-04', 'Butter/tierische Fette',              '83',  4),

  -- 51-Joghurts/Quark
  ('51-01', 'Joghurt, Natur',                      '51',  1),
  ('51-02', 'Joghurt, Frucht',                     '51',  2),
  ('51-04', 'Quark',                               '51',  3),
  ('51-03', 'Joghurtersatzprodukte',               '51',  4),

  -- 50-H-Milchprodukte/Milchersatzprodukte
  ('50-02', 'H-Milch',                             '50',  1),
  ('50-03', 'H-Sahne',                             '50',  2),
  ('50-01', 'H-Käse',                              '50',  3),
  ('50-04', 'Milchersatzprodukte',                  '50',  4),

  -- 84-Käse/Käseersatzprodukte
  ('84-09', 'Käse geschnitten',                    '84',  1),
  ('84-01', 'Hart-/Schnittkäse',                   '84',  2),
  ('84-02', 'Weichkäse',                           '84',  3),
  ('84-03', 'Frischkäse',                          '84',  4),
  ('84-07', 'Käse gerieben/zerkleinert',           '84',  5),
  ('84-05', 'Käseerzeugnisse eigener Art',         '84',  6),
  ('84-04', 'Schmelzkäse',                         '84',  7),
  ('84-06', 'Cheddar am Stück',                    '84',  8),
  ('84-10', 'Käsesnacks',                          '84',  9),

  -- 38-Gemüse
  ('38-03', 'Tomaten',                             '38',  1),
  ('38-02', 'Paprika',                             '38',  2),
  ('38-07', 'Zwiebelgemüse',                       '38',  3),
  ('38-05', 'Wurzel-/Knollengemüse',               '38',  4),
  ('38-06', 'Kartoffeln',                          '38',  5),
  ('38-04', 'Kohlgemüse',                          '38',  6),
  ('38-01', 'Gemüse (hart)',                       '38',  7),
  ('38-08', 'Pilze',                               '38',  8),
  ('38-11', 'Zucchini',                            '38',  9),
  ('38-12', 'Spargel',                             '38', 10),
  ('38-10', 'Kürbisse',                            '38', 11),
  ('38-13', 'Frische Kräuter',                     '38', 12),
  ('38-09', 'Hülsenfrüchte',                       '38', 13),
  ('38-16', 'Sonstiges Gemüse',                    '38', 14),
  ('38-17', 'Snacks/Gemüse, verzehrfertig',        '38', 15),

  -- 58-Obst
  ('58-08', 'Bananen',                             '58',  1),
  ('58-01', 'Äpfel',                               '58',  2),
  ('58-02', 'Birnen',                              '58',  3),
  ('58-06', 'Zitrusfrüchte',                       '58',  4),
  ('58-04', 'Beeren',                              '58',  5),
  ('58-05', 'Trauben',                             '58',  6),
  ('58-03', 'Steinobst',                           '58',  7),
  ('58-07', 'Exotische Früchte',                   '58',  8),
  ('58-11', 'Mangos',                              '58',  9),
  ('58-12', 'Avocados',                            '58', 10),
  ('58-10', 'Melonen',                             '58', 11),
  ('58-15', 'Snacks/Obst, verzehrfertig',          '58', 12),

  -- 54-Nährmittel
  ('54-02', 'Teigwaren',                           '54',  1),
  ('54-01', 'Reis',                                '54',  2),
  ('54-04', 'Kräuter/Gewürze/Würzzutaten',         '54',  3),
  ('54-06', 'Hülsenfrüchte/Getreide',              '54',  4),
  ('54-03', 'Kartoffelprodukte',                   '54',  5),

  -- 52-Dressings/Öle/Soßen
  ('52-02', 'Speiseöle',                           '52',  1),
  ('52-04', 'Soßen/Pesto',                         '52',  2),
  ('52-01', 'Ketchup/Senf',                        '52',  3),
  ('52-03', 'Mayonnaise',                          '52',  4),
  ('52-06', 'Dressings/Marinaden',                 '52',  5),
  ('52-05', 'Essig',                               '52',  6),
  ('52-07', 'Meerrettich',                         '52',  7),

  -- 47-Konserven
  ('47-02', 'Gemüsekonserven',                     '47',  1),
  ('47-03', 'Sauerkonserven',                      '47',  2),
  ('47-06', 'Antipasti, ungekühlt',                '47',  3),
  ('47-01', 'Obstkonserven',                       '47',  4),
  ('47-04', 'Pilzkonserven',                       '47',  5),

  -- 48-Fertiggerichte/Suppen
  ('48-02', 'Eintöpfe/Nasssuppen',                 '48',  1),
  ('48-05', 'Trockensuppen/Fixprodukte',           '48',  2),
  ('48-04', 'Instantgerichte',                     '48',  3),
  ('48-01', 'Fertiggerichte',                      '48',  4),

  -- 72-Gekühlte Fertiggerichte
  ('72-04', 'Teigwaren',                           '72',  1),
  ('72-01', 'Fertiggerichte',                      '72',  2),
  ('72-03', 'Kartoffelprodukte',                   '72',  3),
  ('72-05', 'Backwaren',                           '72',  4),
  ('72-02', 'Pizza',                               '72',  5),

  -- 89-Backartikel
  ('89-01', 'Mehl',                                '89',  1),
  ('89-02', 'Backzutaten',                         '89',  2),
  ('89-03', 'Zucker/Süßungsmittel',                '89',  3),
  ('89-05', 'Backmischungen',                      '89',  4),
  ('89-04', 'Dessertpulver',                       '89',  5),

  -- 53-Konfitüren/Brotaufstriche
  ('53-04', 'Nussaufstriche',                      '53',  1),
  ('53-01', 'Fruchtaufstriche',                    '53',  2),
  ('53-02', 'Honig',                               '53',  3),
  ('53-06', 'Süße Aufstriche',                     '53',  4),
  ('53-05', 'Herzhafte Aufstriche',                '53',  5),
  ('53-03', 'Sirup/Garnierung',                    '53',  6),

  -- 90-Cerealien/Snacks
  ('90-01', 'Cerealien',                           '90',  1),
  ('90-03', 'Snack-/Energie-/Müsliriegel',         '90',  2),

  -- 41-Schokolade/Pralinen
  ('41-01', 'Tafelschokolade',                     '41',  1),
  ('41-02', 'Schokoriegel',                        '41',  2),
  ('41-04', 'Süßwaren mit Schokolade',             '41',  3),
  ('41-03', 'Pralinen',                            '41',  4),

  -- 75-TK Fleisch/Fisch
  ('75-01', 'Fisch/Meeresfrüchte',                 '75',  1),
  ('75-02', 'Hühnchen',                            '75',  2),
  ('75-04', 'Schwein',                             '75',  3),
  ('75-05', 'Rind',                                '75',  4),
  ('75-07', 'Sonstige Fleischwaren',               '75',  5),
  ('75-10', 'Fleischersatzprodukte',               '75',  6),

  -- 78-TK Fertiggerichte/Pizzas
  ('78-02', 'Pizza/Baguettes',                     '78',  1),
  ('78-01', 'Fertig-/Teilfertiggerichte',          '78',  2),
  ('78-03', 'Snacks/Kuchen',                       '78',  3),

  -- 76-TK Obst/Gemüse
  ('76-01', 'Gemüse',                              '76',  1),
  ('76-02', 'Kartoffelprodukte',                   '76',  2),
  ('76-03', 'Obst',                                '76',  3),

  -- 77-TK Desserts/Backwaren/Eis
  ('77-02', 'Eis',                                 '77',  1),
  ('77-03', 'Desserts/Mehlspeisen',                '77',  2),
  ('77-01', 'Backwaren',                           '77',  3),

  -- 45-Kaffee/Kakao
  ('45-02', 'Bohnenkaffee',                        '45',  1),
  ('45-05', 'Kaffeekapseln',                       '45',  2),
  ('45-01', 'Löslicher Kaffee',                    '45',  3),
  ('45-06', 'Einzelportionen/Trinkfertig',         '45',  4),
  ('45-03', 'Kaffeehaltige Heißgetränke',          '45',  5),
  ('45-04', 'Pulvergetränke',                      '45',  6),

  -- 03-Wein
  ('03-02', 'Weißwein',                            '03',  1),
  ('03-01', 'Rotwein',                             '03',  2),
  ('03-03', 'Roséwein',                            '03',  3),
  ('03-05', 'Weinhaltige Getränke/Weine, sortiert','03',  4),
  ('03-04', 'Likör-/Dessertwein',                  '03',  5),

  -- 01-Spirituosen
  ('01-01', 'Spirituosen',                         '01',  1),
  ('01-02', 'Liköre/Bitter',                       '01',  2),
  ('01-03', 'Mixgetränke',                         '01',  3),

  -- 82-Wurst-/Fleisch-/Fischkonserven
  ('82-01', 'Fischkonserven',                      '82',  1),
  ('82-02', 'Wurst-/Fleischkonserven',             '82',  2);

-- =====================================================================
-- 5. Add demand_group_code to products, populate from existing demand_group
-- =====================================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS demand_group_code TEXT
  REFERENCES demand_groups(code);

CREATE INDEX IF NOT EXISTS idx_products_demand_group_code
  ON products (demand_group_code);

-- Populate: extract the numeric prefix (or "AK") from the existing
-- demand_group string (e.g. "83-Milch/Sahne/Butter" -> "83",
-- "AK-Aktionsartikel" -> "AK").
-- Only sets the value when the extracted code exists in demand_groups.
UPDATE products
SET demand_group_code = sub.extracted_code
FROM (
  SELECT product_id,
         CASE
           WHEN demand_group LIKE 'AK-%' THEN 'AK'
           ELSE regexp_replace(demand_group, '-.*', '')
         END AS extracted_code
  FROM products
  WHERE demand_group IS NOT NULL
) sub
WHERE products.product_id = sub.product_id
  AND EXISTS (
    SELECT 1 FROM demand_groups dg
    WHERE dg.code = sub.extracted_code
  );

-- =====================================================================
-- 6. RLS policies – read-only reference data for all roles
-- =====================================================================
ALTER TABLE demand_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE demand_sub_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read demand_groups"
  ON demand_groups FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Allow read demand_sub_groups"
  ON demand_sub_groups FOR SELECT
  TO authenticated, anon
  USING (true);
