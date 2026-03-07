-- Replace orphaned category_id with demand_group_code in search_retailer_products RPC.
-- The categories table was dropped in 20260304000000; category_id is always NULL.
-- demand_group_code is now populated by the categorization pipeline.

CREATE OR REPLACE FUNCTION search_retailer_products(
  p_retailer TEXT,
  p_country TEXT,
  p_user_id UUID,
  p_query TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  product_id UUID,
  name TEXT,
  name_normalized TEXT,
  brand TEXT,
  ean_barcode TEXT,
  weight_or_quantity TEXT,
  country TEXT,
  thumbnail_url TEXT,
  demand_group_code TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  latest_price NUMERIC(10,2),
  user_purchase_count INTEGER,
  global_purchase_count BIGINT
)
LANGUAGE sql STABLE
AS $$
  WITH user_stats AS (
    SELECT competitor_product_id, purchase_count, last_purchased_at
    FROM competitor_product_stats
    WHERE retailer = p_retailer AND user_id = p_user_id
  ),
  global_stats AS (
    SELECT competitor_product_id, SUM(purchase_count)::BIGINT AS total_count
    FROM competitor_product_stats
    WHERE retailer = p_retailer
    GROUP BY competitor_product_id
  ),
  known_products AS (
    SELECT DISTINCT cpp.product_id
    FROM competitor_product_prices cpp
    WHERE cpp.retailer = p_retailer

    UNION

    SELECT DISTINCT cps.competitor_product_id
    FROM competitor_product_stats cps
    WHERE cps.retailer = p_retailer

    UNION

    SELECT DISTINCT li.competitor_product_id
    FROM list_items li
    WHERE li.buy_elsewhere_retailer = p_retailer
      AND li.competitor_product_id IS NOT NULL

    UNION

    SELECT cp2.product_id
    FROM competitor_products cp2
    WHERE cp2.retailer = p_retailer
      AND cp2.country = p_country
      AND cp2.status = 'active'
  ),
  latest_prices AS (
    SELECT DISTINCT ON (product_id) product_id, price
    FROM competitor_product_prices
    WHERE retailer = p_retailer
    ORDER BY product_id, observed_at DESC
  )
  SELECT
    cp.product_id,
    cp.name,
    cp.name_normalized,
    cp.brand,
    cp.ean_barcode,
    cp.weight_or_quantity,
    cp.country,
    cp.thumbnail_url,
    cp.demand_group_code,
    cp.status,
    cp.created_at,
    cp.updated_at,
    lp.price AS latest_price,
    COALESCE(us.purchase_count, 0) AS user_purchase_count,
    COALESCE(gs.total_count, 0) AS global_purchase_count
  FROM competitor_products cp
  JOIN known_products kp ON kp.product_id = cp.product_id
  LEFT JOIN user_stats us ON us.competitor_product_id = cp.product_id
  LEFT JOIN global_stats gs ON gs.competitor_product_id = cp.product_id
  LEFT JOIN latest_prices lp ON lp.product_id = cp.product_id
  WHERE cp.country = p_country
    AND cp.status = 'active'
    AND (
      p_query IS NULL
      OR p_query = ''
      OR cp.name_normalized ILIKE '%' || p_query || '%'
      OR (cp.brand IS NOT NULL AND cp.brand ILIKE '%' || p_query || '%')
    )
  ORDER BY
    CASE WHEN COALESCE(us.purchase_count, 0) > 0 THEN 0 ELSE 1 END,
    COALESCE(us.purchase_count, 0) DESC,
    COALESCE(gs.total_count, 0) DESC,
    cp.name ASC
  LIMIT p_limit;
$$;
