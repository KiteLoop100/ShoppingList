-- BL-62 Phase 2b: Make category_id nullable on list_items and trip_items
-- during transition to demand_group_code. The column will be dropped in Phase 4.

ALTER TABLE list_items ALTER COLUMN category_id DROP NOT NULL;
ALTER TABLE trip_items ALTER COLUMN category_id DROP NOT NULL;
