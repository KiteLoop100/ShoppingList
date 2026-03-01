-- ALDI Data Import: Part 1 – Categories

INSERT INTO categories (name, default_sort_position) VALUES ('Alcoholic Beverages', 1);
INSERT INTO categories (name, default_sort_position) VALUES ('Bakery', 2);
INSERT INTO categories (name, default_sort_position) VALUES ('Breakfast', 3);
INSERT INTO categories (name, default_sort_position) VALUES ('Dairy', 4);
INSERT INTO categories (name, default_sort_position) VALUES ('Chilled Convenience', 5);
INSERT INTO categories (name, default_sort_position) VALUES ('Fresh Meat & Fish', 6);
INSERT INTO categories (name, default_sort_position) VALUES ('Freezer', 7);
INSERT INTO categories (name, default_sort_position) VALUES ('Fruits & Vegetables', 8);
INSERT INTO categories (name, default_sort_position) VALUES ('Pantry', 9);
INSERT INTO categories (name, default_sort_position) VALUES ('Non-Alcoholic Beverages', 10);
INSERT INTO categories (name, default_sort_position) VALUES ('Snacking', 11);
INSERT INTO categories (name, default_sort_position) VALUES ('Electronics', 12);
INSERT INTO categories (name, default_sort_position) VALUES ('Fashion', 13);
INSERT INTO categories (name, default_sort_position) VALUES ('Health, Beauty & Baby', 14);
INSERT INTO categories (name, default_sort_position) VALUES ('Home Improvement', 15);
INSERT INTO categories (name, default_sort_position) VALUES ('Household', 16);
INSERT INTO categories (name, default_sort_position) VALUES ('Outdoor/Leisure', 17);
INSERT INTO categories (name, default_sort_position) VALUES ('Services', 18);

-- Fallback category for API routes
INSERT INTO categories (name, default_sort_position) VALUES ('Sonstiges', 99);

-- Verify
SELECT name, default_sort_position FROM categories ORDER BY default_sort_position;
