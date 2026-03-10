-- Add gps_enabled preference to user_settings.
-- Defaults to true so existing users keep current behavior.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS gps_enabled BOOLEAN NOT NULL DEFAULT true;
