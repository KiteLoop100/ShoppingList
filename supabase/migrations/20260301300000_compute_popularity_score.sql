-- Compute popularity_score from sales_volume_week (linear normalization per country),
-- then permanently drop the confidential sales_volume_week column.

-- Step 1: Linear normalization per country (0.0 – 1.0)
WITH bounds AS (
  SELECT country, MAX(sales_volume_week) AS max_vol
  FROM products
  WHERE sales_volume_week IS NOT NULL AND sales_volume_week > 0
  GROUP BY country
)
UPDATE products p
SET popularity_score = ROUND(
  p.sales_volume_week / b.max_vol, 4
)
FROM bounds b
WHERE p.country = b.country
  AND p.sales_volume_week IS NOT NULL
  AND p.sales_volume_week > 0;

-- Step 2: Permanently remove confidential sales data
UPDATE products SET sales_volume_week = NULL;
ALTER TABLE products DROP COLUMN IF EXISTS sales_volume_week;
