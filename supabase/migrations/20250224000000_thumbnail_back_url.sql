-- Product back-side thumbnail (Rückseite). List shows only thumbnail_url (front); detail view can show both.
ALTER TABLE products ADD COLUMN IF NOT EXISTS thumbnail_back_url TEXT;
