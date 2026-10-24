-- Enable Supabase Realtime (postgres_changes) for list_items.
--
-- use-list-data.ts has subscribed to `list_items` changes since the account
-- feature (FEATURES-ACCOUNT.md §4), but the table was never added to the
-- `supabase_realtime` publication, so the server rejected every subscription
-- ("Unable to subscribe to changes with given parameters") and multi-device
-- list sync only happened on reload. Found by e2e test (g), 2026-10-24.
--
-- RLS on list_items ("Users can manage own list items", owner via
-- shopping_lists.user_id = auth.uid()) also applies to Realtime, so a user
-- only receives events for their own lists (e2e test h).
--
-- REPLICA IDENTITY FULL: with the default identity a DELETE event carries
-- only the primary key, so Realtime cannot evaluate the subscription filter
-- `list_id=eq.<id>` and drops the event — deletions on one device would never
-- reach the other (e2e test i). FULL puts the whole old row into the WAL.

ALTER PUBLICATION supabase_realtime ADD TABLE list_items;
ALTER TABLE list_items REPLICA IDENTITY FULL;
