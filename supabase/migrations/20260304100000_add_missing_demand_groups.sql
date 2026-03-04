-- Add demand_groups that exist in the V2 product data but were missing
-- from the initial seed (non-food specials, services, etc.)

INSERT INTO demand_groups (code, name, name_en, icon, color, sort_position) VALUES
  ('12', 'Audio/Video/Batterien',                    'Audio / Video / Batteries',      '🔋', '#546E7A', 62),
  ('14', 'Kinder-Textilien',                         'Kids Clothing',                  '👕', '#7986CB', 63),
  ('15', 'Herren-Textilien',                         'Men''s Clothing',                '👔', '#5C6BC0', 64),
  ('16', 'Damen-Textilien',                          'Women''s Clothing',              '👗', '#AB47BC', 65),
  ('17', 'Sport & Sportbekleidung',                  'Sports & Sportswear',            '⚽', '#66BB6A', 66),
  ('18', 'Heimtextilien',                            'Home Textiles',                  '🛏️', '#8D6E63', 67),
  ('19', 'Möbel',                                    'Furniture',                      '🪑', '#A1887F', 68),
  ('20', 'Unterhaltungselektronik',                  'Consumer Electronics',           '📱', '#78909C', 69),
  ('22', 'Heimwerkerbedarf',                         'DIY / Hardware',                 '🔧', '#90A4AE', 70),
  ('27', 'Pflanzen/Blumen',                          'Plants / Flowers',               '🌻', '#4CAF50', 71),
  ('28', 'Schreibwaren/Büroartikel/Papeterie',       'Stationery / Office Supplies',   '✏️', '#B0BEC5', 72),
  ('29', 'Deko-Artikel',                             'Decorative Items',               '🖼️', '#BCAAA4', 73),
  ('30', 'Koffer/Taschen',                           'Luggage / Bags',                 '🧳', '#795548', 74),
  ('31', 'Gartenbedarf',                             'Garden Supplies',                '🌱', '#388E3C', 75),
  ('32', 'Spielwaren',                               'Toys',                           '🧸', '#EF6C00', 76),
  ('33', 'Auto/Motorrad/Fahrrad',                    'Auto / Bike',                    '🚗', '#455A64', 77),
  ('34', 'Sport/Camping/Freizeit',                   'Sports / Camping / Leisure',     '⛺', '#2E7D32', 78),
  ('35', 'Haushaltsgeräte',                          'Household Appliances',           '🏠', '#607D8B', 79),
  ('36', 'Schuhe',                                   'Shoes',                          '👟', '#8D6E63', 80),
  ('39', 'Tierbedarf',                               'Pet Supplies',                   '🐕', '#6D4C41', 81),
  ('59', 'Tabakwaren',                               'Tobacco',                        '🚬', '#9E9E9E', 82),
  ('63', 'Geschenkkarten/Gutscheine/Tickets/Coupon', 'Gift Cards / Vouchers',          '🎁', '#FFB300', 83),
  ('92', 'Beleuchtung',                              'Lighting',                       '💡', '#FDD835', 84),
  ('93', 'ALDI Services',                            'ALDI Services',                  '🏷️', '#0050A0', 85)
ON CONFLICT (code) DO NOTHING;
