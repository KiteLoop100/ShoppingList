-- Seed typical_shelf_life_days for Vollmilch and Joghurt products.
-- Values are conservative estimates for sealed products.

-- Fresh milk (ESL) in demand_group 83: ~21 days
UPDATE products
SET typical_shelf_life_days = 21
WHERE name_normalized ILIKE '%vollmilch%'
  AND demand_group_code = '83'
  AND name_normalized NOT ILIKE '%h-vollmilch%'
  AND name_normalized NOT ILIKE '%haltbar%'
  AND status = 'active';

-- H-Milch (UHT long-life milk): ~180 days sealed
UPDATE products
SET typical_shelf_life_days = 180
WHERE name_normalized ILIKE '%vollmilch%'
  AND (name_normalized ILIKE '%h-vollmilch%'
    OR name_normalized ILIKE '%h vollmilch%'
    OR name_normalized ILIKE '%haltbar%'
    OR demand_group_code = '50')
  AND status = 'active';

-- Fresh yogurt (demand_group 51): ~21 days
UPDATE products
SET typical_shelf_life_days = 21
WHERE name_normalized ILIKE '%joghurt%'
  AND demand_group_code = '51'
  AND status = 'active';

-- Trinkjoghurt / Ayran (demand_group 83, chilled drinks): ~28 days
UPDATE products
SET typical_shelf_life_days = 28
WHERE name_normalized ILIKE '%joghurt%'
  AND demand_group_code = '83'
  AND status = 'active';
