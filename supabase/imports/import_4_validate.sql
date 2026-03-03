-- ALDI Data Import: Part 4 – Validation
-- Run after all imports

-- Product counts by country and assortment
SELECT country, assortment_type, COUNT(*) 
FROM products 
GROUP BY country, assortment_type 
ORDER BY country, assortment_type;

-- Expected: DE daily_range=4163, special_food=332, special_nonfood=809
-- Expected: AT daily_range=1959, special_food=115, special_nonfood=205

-- Store counts
SELECT country, COUNT(*) FROM stores GROUP BY country;
-- Expected: DE=2050, AT=558

-- Demand group distribution
SELECT dg.code, dg.name, COUNT(p.product_id) as product_count
FROM demand_groups dg
LEFT JOIN products p ON dg.code = p.demand_group_code
GROUP BY dg.code, dg.name
ORDER BY dg.sort_position;

-- EAN format check
SELECT ean_barcode, LENGTH(ean_barcode) 
FROM products 
WHERE ean_barcode IS NOT NULL 
LIMIT 10;

-- Null checks
SELECT 
  COUNT(*) as total,
  COUNT(article_number) as has_article_nr,
  COUNT(ean_barcode) as has_ean,
  COUNT(brand) as has_brand,
  COUNT(price) as has_price,
  COUNT(receipt_abbreviation) as has_receipt_abbr
FROM products;

-- Stores GPS check
SELECT external_id, name, latitude, longitude 
FROM stores 
WHERE latitude = 0 OR longitude = 0;

-- Archive verification (should match old counts)
SELECT 'products_archive' as tbl, COUNT(*) FROM products_archive_20260227
UNION ALL SELECT 'stores_archive', COUNT(*) FROM stores_archive_20260227;
