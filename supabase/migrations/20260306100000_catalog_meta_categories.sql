-- Migration: Add meta-categories for the catalog view
--
-- Inserts 14 parent demand_group rows (meta-categories) and sets
-- parent_group on all 61 existing demand groups to link them.
-- The existing demand groups remain unchanged for product assignment;
-- meta-categories are used only for catalog navigation.

-- =====================================================================
-- 1. Insert 14 meta-category rows (parent_group IS NULL)
-- =====================================================================
INSERT INTO demand_groups (code, name, name_en, icon, color, sort_position) VALUES
  ('M01', 'Obst & Gemüse',              'Fruit & Vegetables',       '🥬', '#1DB954',  1),
  ('M02', 'Brot & Backwaren',            'Bread & Bakery',           '🍞', '#D4960F',  2),
  ('M03', 'Milchprodukte & Eier',        'Dairy & Eggs',             '🥛', '#2196F3',  3),
  ('M04', 'Fleisch, Fisch & Wurst',      'Meat, Fish & Cold Cuts',   '🥩', '#EF5350',  4),
  ('M05', 'Feinkost & Fertiggerichte',   'Deli & Ready Meals',       '🍱', '#0097A7',  5),
  ('M06', 'Tiefkühl',                    'Frozen',                   '🧊', '#5C8DAE',  6),
  ('M07', 'Getränke',                    'Beverages',                '🥤', '#1976D2',  7),
  ('M08', 'Kaffee & Tee',               'Coffee & Tea',             '☕', '#8B5E3C',  8),
  ('M09', 'Süßwaren & Snacks',          'Sweets & Snacks',          '🍫', '#F4511E',  9),
  ('M10', 'Grundnahrungsmittel',         'Staples',                  '🍝', '#A07048', 10),
  ('M11', 'Haushalt',                    'Household',                '🏠', '#708090', 11),
  ('M12', 'Körperpflege & Baby',         'Personal Care & Baby',     '💄', '#E91E63', 12),
  ('M13', 'Tiernahrung',                 'Pet Food',                 '🐾', '#506878', 13),
  ('M14', 'Aktionsartikel',              'Promotional Items',        '🏷️', '#0050A0', 14)
ON CONFLICT (code) DO NOTHING;

-- =====================================================================
-- 2. Link existing demand groups to their meta-category via parent_group
-- =====================================================================

-- M01: Obst & Gemüse
UPDATE demand_groups SET parent_group = 'M01' WHERE code IN ('38', '58', '88');

-- M02: Brot & Backwaren
UPDATE demand_groups SET parent_group = 'M02' WHERE code IN ('56', '57', '89');

-- M03: Milchprodukte & Eier
UPDATE demand_groups SET parent_group = 'M03' WHERE code IN ('50', '51', '55', '60', '83', '84');

-- M04: Fleisch, Fisch & Wurst
UPDATE demand_groups SET parent_group = 'M04' WHERE code IN ('49', '62', '64', '67', '68', '69', '70', '71', '82');

-- M05: Feinkost & Fertiggerichte
UPDATE demand_groups SET parent_group = 'M05' WHERE code IN ('47', '48', '72', '73');

-- M06: Tiefkühl
UPDATE demand_groups SET parent_group = 'M06' WHERE code IN ('75', '76', '77', '78');

-- M07: Getränke
UPDATE demand_groups SET parent_group = 'M07' WHERE code IN ('01', '02', '03', '04', '05', '74', '79', '80', '81');

-- M08: Kaffee & Tee
UPDATE demand_groups SET parent_group = 'M08' WHERE code IN ('45', '46');

-- M09: Süßwaren & Snacks
UPDATE demand_groups SET parent_group = 'M09' WHERE code IN ('40', '41', '42', '43', '44', '86', '87', '90');

-- M10: Grundnahrungsmittel
UPDATE demand_groups SET parent_group = 'M10' WHERE code IN ('52', '53', '54');

-- M11: Haushalt
UPDATE demand_groups SET parent_group = 'M11' WHERE code IN ('06', '10', '11', '25');

-- M12: Körperpflege & Baby
UPDATE demand_groups SET parent_group = 'M12' WHERE code IN ('07', '08', '09', '13');

-- M13: Tiernahrung
UPDATE demand_groups SET parent_group = 'M13' WHERE code IN ('85');

-- M14: Aktionsartikel
UPDATE demand_groups SET parent_group = 'M14' WHERE code IN ('AK');
