-- Pairwise comparisons for 3-level learning (LEARNING-LOGIC 2.4, FEATURES F03 Modus 2)
-- level: group = Demand Groups, subgroup = Demand Sub-Groups within a group, product = Products within a sub-group
-- scope: null for group; demand_group for subgroup; demand_group || '|' || demand_sub_group for product
-- item_a, item_b: identifiers (group name, "group|subgroup", or product_id); stored with item_a < item_b for uniqueness

CREATE TABLE pairwise_comparisons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('group', 'subgroup', 'product')),
  scope TEXT,
  item_a TEXT NOT NULL,
  item_b TEXT NOT NULL,
  a_before_b_count INTEGER NOT NULL DEFAULT 0,
  b_before_a_count INTEGER NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT item_order CHECK (item_a < item_b)
);

CREATE UNIQUE INDEX idx_pairwise_unique ON pairwise_comparisons (store_id, level, COALESCE(scope, ''), item_a, item_b);
CREATE INDEX idx_pairwise_store_level ON pairwise_comparisons (store_id, level);
CREATE INDEX idx_pairwise_scope ON pairwise_comparisons (store_id, level, scope) WHERE scope IS NOT NULL;

COMMENT ON TABLE pairwise_comparisons IS 'Per-store pairwise checkoff counts for hierarchical sort: group, subgroup, product levels';
COMMENT ON COLUMN pairwise_comparisons.scope IS 'Null for group; demand_group for subgroup; demand_group|demand_sub_group for product';
COMMENT ON COLUMN pairwise_comparisons.item_a IS 'First identifier (group name, group|subgroup, or product_id); always < item_b';
COMMENT ON COLUMN pairwise_comparisons.item_b IS 'Second identifier; always > item_a';
