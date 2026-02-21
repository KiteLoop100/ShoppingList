-- Add weight_or_quantity to products (Gewicht/Menge, z. B. "500 g", "1 l")
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_or_quantity TEXT;
