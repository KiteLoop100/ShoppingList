-- Manual deferral: "Nächster Einkauf" swipe action.
-- When set (e.g. 'next_trip'), the item is manually deferred and
-- moves to the deferred section, not counting toward the current trip.
ALTER TABLE list_items ADD COLUMN deferred_until TEXT DEFAULT NULL;
