-- Enable Supabase Realtime for user_settings so changes on one device
-- are pushed to all other open sessions via postgres_changes subscription.
ALTER PUBLICATION supabase_realtime ADD TABLE user_settings;
