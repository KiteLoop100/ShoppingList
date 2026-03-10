-- Phase 5: FK constraints on demand_group / demand_sub_group references.
--
-- Requires Phase 2 (demand_sub_groups table populated).
-- All referenced codes must exist in demand_groups/demand_sub_groups.

-- 1) FK: products.demand_sub_group → demand_sub_groups(code)
ALTER TABLE products
  ADD CONSTRAINT fk_products_demand_sub_group
  FOREIGN KEY (demand_sub_group) REFERENCES demand_sub_groups(code)
  ON UPDATE CASCADE ON DELETE SET NULL;

-- 2) FK: competitor_products.demand_group_code → demand_groups(code)
ALTER TABLE competitor_products
  ADD CONSTRAINT fk_competitor_products_demand_group
  FOREIGN KEY (demand_group_code) REFERENCES demand_groups(code)
  ON UPDATE CASCADE ON DELETE SET NULL;

-- 3) FK: competitor_products.demand_sub_group → demand_sub_groups(code)
ALTER TABLE competitor_products
  ADD CONSTRAINT fk_competitor_products_demand_sub_group
  FOREIGN KEY (demand_sub_group) REFERENCES demand_sub_groups(code)
  ON UPDATE CASCADE ON DELETE SET NULL;
