-- Enforce at most one active shopping list per user (spec: DATA-MODEL).
-- 1) Merge duplicate active lists onto the newest list (max created_at).
-- 2) Deduplicate list_items (same product_id or same generic row key).
-- 3) Partial unique index on (user_id) WHERE status = 'active'.

-- ── 1) Merge multiple active lists per user onto canonical (newest) list ──
WITH canonical AS (
  SELECT DISTINCT ON (user_id)
    list_id AS keep_id,
    user_id
  FROM shopping_lists
  WHERE status = 'active'
  ORDER BY user_id, created_at DESC, list_id DESC
)
UPDATE list_items AS li
SET list_id = c.keep_id
FROM shopping_lists AS sl
JOIN canonical AS c ON c.user_id = sl.user_id
WHERE sl.status = 'active'
  AND sl.list_id <> c.keep_id
  AND li.list_id = sl.list_id;

WITH canonical AS (
  SELECT DISTINCT ON (user_id)
    list_id AS keep_id,
    user_id
  FROM shopping_lists
  WHERE status = 'active'
  ORDER BY user_id, created_at DESC, list_id DESC
)
DELETE FROM shopping_lists AS sl
USING canonical AS c
WHERE sl.user_id = c.user_id
  AND sl.status = 'active'
  AND sl.list_id <> c.keep_id;

-- ── 2a) Deduplicate rows with same (list_id, product_id), product_id NOT NULL ──
WITH dup AS (
  SELECT
    list_id,
    product_id,
    (array_agg(item_id ORDER BY added_at ASC, item_id ASC))[1] AS keep_item_id,
    SUM(quantity)::integer AS sum_qty
  FROM list_items
  WHERE product_id IS NOT NULL
  GROUP BY list_id, product_id
  HAVING COUNT(*) > 1
)
UPDATE list_items AS li
SET
  quantity = dup.sum_qty,
  updated_at = now()
FROM dup
WHERE li.item_id = dup.keep_item_id;

DELETE FROM list_items AS li
WHERE li.item_id IN (
  SELECT li2.item_id
  FROM list_items AS li2
  JOIN (
    SELECT
      list_id,
      product_id,
      (array_agg(item_id ORDER BY added_at ASC, item_id ASC))[1] AS keep_item_id
    FROM list_items
    WHERE product_id IS NOT NULL
    GROUP BY list_id, product_id
    HAVING COUNT(*) > 1
  ) AS d ON li2.list_id = d.list_id
    AND li2.product_id = d.product_id
    AND li2.item_id <> d.keep_item_id
);

-- ── 2b) Deduplicate generic rows (product_id IS NULL) on same list + same identity ──
WITH dup AS (
  SELECT
    list_id,
    display_name,
    COALESCE(custom_name, '') AS cn,
    COALESCE(buy_elsewhere_retailer, '') AS ber,
    COALESCE(competitor_product_id::text, '') AS cpid,
    (array_agg(item_id ORDER BY added_at ASC, item_id ASC))[1] AS keep_item_id,
    SUM(quantity)::integer AS sum_qty
  FROM list_items
  WHERE product_id IS NULL
  GROUP BY
    list_id,
    display_name,
    COALESCE(custom_name, ''),
    COALESCE(buy_elsewhere_retailer, ''),
    COALESCE(competitor_product_id::text, '')
  HAVING COUNT(*) > 1
)
UPDATE list_items AS li
SET
  quantity = dup.sum_qty,
  updated_at = now()
FROM dup
WHERE li.item_id = dup.keep_item_id;

DELETE FROM list_items AS li
WHERE li.item_id IN (
  SELECT li2.item_id
  FROM list_items AS li2
  JOIN (
    SELECT
      list_id,
      display_name,
      COALESCE(custom_name, '') AS cn,
      COALESCE(buy_elsewhere_retailer, '') AS ber,
      COALESCE(competitor_product_id::text, '') AS cpid,
      (array_agg(item_id ORDER BY added_at ASC, item_id ASC))[1] AS keep_item_id
    FROM list_items
    WHERE product_id IS NULL
    GROUP BY
      list_id,
      display_name,
      COALESCE(custom_name, ''),
      COALESCE(buy_elsewhere_retailer, ''),
      COALESCE(competitor_product_id::text, '')
    HAVING COUNT(*) > 1
  ) AS d ON li2.list_id = d.list_id
    AND li2.display_name = d.display_name
    AND COALESCE(li2.custom_name, '') = d.cn
    AND COALESCE(li2.buy_elsewhere_retailer, '') = d.ber
    AND COALESCE(li2.competitor_product_id::text, '') = d.cpid
    AND li2.item_id <> d.keep_item_id
);

-- ── 3) One active list per user (Postgres partial unique index) ──
CREATE UNIQUE INDEX idx_shopping_lists_one_active_per_user
  ON shopping_lists (user_id)
  WHERE (status = 'active');
