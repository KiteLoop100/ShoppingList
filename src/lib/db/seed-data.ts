/**
 * Seed data for IndexedDB bootstrap (demand groups + stores).
 *
 * Demand groups match the official ALDI commodity group codes in Supabase.
 * Products come from the ALDI import and are not seeded here.
 */

import type { DemandGroup, Store } from "@/types";

function now(): string {
  return new Date().toISOString();
}

export const SEED_DEMAND_GROUPS: DemandGroup[] = [
  // Alcohol
  { code: "01", name: "Spirituosen",                              name_en: "Spirits",                        icon: "🥃", color: "#5E35B1", sort_position:  1 },
  { code: "02", name: "Sekt/Schaumwein",                          name_en: "Sparkling Wine",                 icon: "🥂", color: "#AD1457", sort_position:  2 },
  { code: "03", name: "Wein",                                     name_en: "Wine",                           icon: "🍷", color: "#880E4F", sort_position:  3 },
  { code: "04", name: "Bier",                                     name_en: "Beer",                           icon: "🍺", color: "#2E7D32", sort_position:  4 },

  // Non-alcoholic beverages
  { code: "05", name: "Wasser",                                   name_en: "Water",                          icon: "💧", color: "#1976D2", sort_position:  5 },
  { code: "79", name: "Funktionsgetränke/Eistee",                 name_en: "Functional Drinks / Iced Tea",   icon: "🧃", color: "#2196F3", sort_position:  6 },
  { code: "80", name: "Erfrischungsgetränke",                     name_en: "Soft Drinks",                    icon: "🥤", color: "#1565C0", sort_position:  7 },
  { code: "81", name: "Fruchtsäfte/Sirupe",                       name_en: "Juices / Syrups",                icon: "🧃", color: "#0D47A1", sort_position:  8 },

  // Health, beauty, baby
  { code: "07", name: "Kosmetik/Körperpflege",                    name_en: "Cosmetics / Personal Care",      icon: "💄", color: "#E91E63", sort_position:  9 },
  { code: "08", name: "Körperhygiene",                            name_en: "Body Hygiene",                   icon: "🧴", color: "#D81B60", sort_position: 10 },
  { code: "09", name: "Babyartikel",                              name_en: "Baby Products",                  icon: "👶", color: "#EC407A", sort_position: 11 },
  { code: "13", name: "Apothekenprodukte",                        name_en: "Pharmacy Products",              icon: "💊", color: "#C2185B", sort_position: 12 },

  // Household / cleaning
  { code: "06", name: "Wasch-/Putz-/Reinigungsmittel",            name_en: "Cleaning Products",              icon: "🧹", color: "#607080", sort_position: 13 },
  { code: "10", name: "Papierwaren",                              name_en: "Paper Products",                 icon: "🧻", color: "#7890A0", sort_position: 14 },
  { code: "11", name: "Folien/Tücher",                            name_en: "Foil / Cloths",                  icon: "🧽", color: "#5A7088", sort_position: 15 },
  { code: "25", name: "Haushaltsartikel",                         name_en: "Household Items",                icon: "🏠", color: "#708090", sort_position: 16 },

  // Fruits & vegetables
  { code: "38", name: "Gemüse",                                   name_en: "Vegetables",                     icon: "🥦", color: "#1DB954", sort_position: 17 },
  { code: "58", name: "Obst",                                     name_en: "Fruit",                          icon: "🍎", color: "#28A745", sort_position: 18 },
  { code: "88", name: "Salate",                                   name_en: "Salads",                         icon: "🥗", color: "#15A040", sort_position: 19 },

  // Snacking / sweets
  { code: "40", name: "Bonbons/Kaugummi",                         name_en: "Candy / Chewing Gum",            icon: "🍬", color: "#F4511E", sort_position: 20 },
  { code: "41", name: "Schokolade/Pralinen",                      name_en: "Chocolate / Pralines",           icon: "🍫", color: "#D84315", sort_position: 21 },
  { code: "42", name: "Gebäck",                                   name_en: "Biscuits / Cookies",             icon: "🍪", color: "#E65100", sort_position: 22 },
  { code: "43", name: "Saisonartikel Süßwaren",                   name_en: "Seasonal Sweets",                icon: "🎄", color: "#BF360C", sort_position: 23 },
  { code: "44", name: "Salzgebäck",                               name_en: "Salty Snacks",                   icon: "🥨", color: "#E64A19", sort_position: 24 },
  { code: "86", name: "Chips/Snacks",                             name_en: "Chips / Snacks",                 icon: "🍿", color: "#C43E00", sort_position: 25 },
  { code: "87", name: "Nüsse/Trockenfrüchte",                     name_en: "Nuts / Dried Fruit",             icon: "🥜", color: "#A84000", sort_position: 26 },

  // Coffee & tea
  { code: "45", name: "Kaffee/Kakao",                             name_en: "Coffee / Cocoa",                 icon: "☕", color: "#8B5E3C", sort_position: 27 },
  { code: "46", name: "Tee",                                      name_en: "Tea",                            icon: "🍵", color: "#7D5230", sort_position: 28 },

  // Pantry / dry goods
  { code: "47", name: "Konserven",                                name_en: "Canned Goods",                   icon: "🥫", color: "#986040", sort_position: 29 },
  { code: "48", name: "Fertiggerichte/Suppen",                    name_en: "Ready Meals / Soups",            icon: "🍜", color: "#B08058", sort_position: 30 },
  { code: "49", name: "Dauerwurst/Speck",                         name_en: "Cured Sausage / Bacon",          icon: "🥓", color: "#B04050", sort_position: 31 },
  { code: "50", name: "H-Milchprodukte/Milchersatzprodukte",      name_en: "UHT Dairy / Dairy Alternatives", icon: "🥛", color: "#1565C0", sort_position: 32 },
  { code: "51", name: "Joghurts/Quark",                           name_en: "Yoghurt / Quark",                icon: "🥄", color: "#1E88E5", sort_position: 33 },
  { code: "52", name: "Dressings/Öle/Soßen",                      name_en: "Dressings / Oils / Sauces",      icon: "🫒", color: "#AA7850", sort_position: 34 },
  { code: "53", name: "Konfitüren/Brotaufstriche",                name_en: "Jams / Spreads",                 icon: "🍯", color: "#8C5C38", sort_position: 35 },
  { code: "54", name: "Nährmittel",                               name_en: "Staples (Pasta, Rice, Spices)",  icon: "🍝", color: "#A07048", sort_position: 36 },
  { code: "55", name: "Eier",                                     name_en: "Eggs",                           icon: "🥚", color: "#C49520", sort_position: 37 },

  // Bakery
  { code: "56", name: "Bake-Off",                                 name_en: "Bake-Off (In-Store Bakery)",     icon: "🥐", color: "#E8A817", sort_position: 38 },
  { code: "57", name: "Brot/Kuchen",                              name_en: "Bread / Cake",                   icon: "🍞", color: "#D4960F", sort_position: 39 },

  // Dairy
  { code: "60", name: "Margarine/pflanzliche Fette",              name_en: "Margarine / Plant Fats",         icon: "🧈", color: "#1976D2", sort_position: 40 },
  { code: "83", name: "Milch/Sahne/Butter",                       name_en: "Milk / Cream / Butter",          icon: "🥛", color: "#2196F3", sort_position: 41 },
  { code: "84", name: "Käse/Käseersatzprodukte",                  name_en: "Cheese",                         icon: "🧀", color: "#42A5F5", sort_position: 42 },

  // Fresh meat & fish
  { code: "62", name: "Frischfleisch (ohne Schwein/Geflügel)",    name_en: "Fresh Meat (excl. Pork/Poultry)",icon: "🥩", color: "#EF5350", sort_position: 43 },
  { code: "64", name: "Fisch, frisch",                            name_en: "Fresh Fish",                     icon: "🐟", color: "#C62828", sort_position: 44 },
  { code: "67", name: "Geflügel, frisch",                         name_en: "Fresh Poultry",                  icon: "🍗", color: "#D32F2F", sort_position: 45 },
  { code: "68", name: "Schweinefleisch, frisch",                  name_en: "Fresh Pork",                     icon: "🥩", color: "#E53935", sort_position: 46 },

  // Chilled meat / sausage
  { code: "69", name: "Gekühlte Wurstwaren",                      name_en: "Chilled Cold Cuts",              icon: "🥓", color: "#C04858", sort_position: 47 },
  { code: "70", name: "Gekühltes verzehrfertiges Fleisch/Fleisc", name_en: "Chilled Ready-to-Eat Meat",      icon: "🍖", color: "#D05060", sort_position: 48 },
  { code: "82", name: "Wurst-/Fleisch-/Fischkonserven",           name_en: "Canned Meat / Fish",             icon: "🥫", color: "#A83848", sort_position: 49 },

  // Chilled convenience
  { code: "71", name: "Gekühlter verzehrfertiger Fisch",          name_en: "Chilled Ready-to-Eat Fish",      icon: "🐟", color: "#00838F", sort_position: 50 },
  { code: "72", name: "Gekühlte Fertiggerichte",                  name_en: "Chilled Ready Meals",            icon: "🍱", color: "#0097A7", sort_position: 51 },
  { code: "73", name: "Gekühlte Feinkost",                        name_en: "Chilled Deli",                   icon: "🥙", color: "#00ACC1", sort_position: 52 },
  { code: "74", name: "Gekühlte Getränke",                        name_en: "Chilled Beverages",              icon: "🧊", color: "#00BCD4", sort_position: 53 },

  // Frozen
  { code: "75", name: "TK Fleisch/Fisch",                         name_en: "Frozen Meat / Fish",             icon: "🧊", color: "#5C8DAE", sort_position: 54 },
  { code: "76", name: "TK Obst/Gemüse",                           name_en: "Frozen Fruit / Vegetables",      icon: "🥶", color: "#6E9DBE", sort_position: 55 },
  { code: "77", name: "TK Desserts/Backwaren/Eis",                name_en: "Frozen Desserts / Ice Cream",    icon: "🍦", color: "#5490B0", sort_position: 56 },
  { code: "78", name: "TK Fertiggerichte/Pizzas",                 name_en: "Frozen Ready Meals / Pizza",     icon: "🍕", color: "#4A7D9E", sort_position: 57 },

  // Pet food
  { code: "85", name: "Tiernahrung",                              name_en: "Pet Food",                       icon: "🐾", color: "#506878", sort_position: 58 },

  // Baking / cereals
  { code: "89", name: "Backartikel",                              name_en: "Baking Supplies",                icon: "🧁", color: "#C08A0A", sort_position: 59 },
  { code: "90", name: "Cerealien/Snacks",                         name_en: "Cereals / Snack Bars",           icon: "🥣", color: "#946640", sort_position: 60 },

  // Promotional
  { code: "AK", name: "Aktionsartikel",                           name_en: "Promotional Items",              icon: "🏷️", color: "#0050A0", sort_position: 61 },
];

/** Demo stores for F04 (GPS radius ~50-100m). Coordinates are example values. */
export const SEED_STORES: Store[] = [
  {
    store_id: "store-aldi-musterstr",
    name: "ALDI SÜD Musterstraße",
    address: "Musterstraße 12, 40215 Düsseldorf",
    city: "Düsseldorf",
    postal_code: "40215",
    country: "DE",
    latitude: 51.2277,
    longitude: 6.7735,
    has_sorting_data: false,
    sorting_data_quality: 0,
    created_at: now(),
    updated_at: now(),
  },
  {
    store_id: "store-aldi-konrad",
    name: "ALDI SÜD Konrad-Adenauer-Platz",
    address: "Konrad-Adenauer-Platz 1, 40210 Düsseldorf",
    city: "Düsseldorf",
    postal_code: "40210",
    country: "DE",
    latitude: 51.2189,
    longitude: 6.7812,
    has_sorting_data: false,
    sorting_data_quality: 0,
    created_at: now(),
    updated_at: now(),
  },
  {
    store_id: "store-aldi-schadow",
    name: "ALDI SÜD Schadowstraße",
    address: "Schadowstraße 42, 40212 Düsseldorf",
    city: "Düsseldorf",
    postal_code: "40212",
    country: "DE",
    latitude: 51.2245,
    longitude: 6.7820,
    has_sorting_data: false,
    sorting_data_quality: 0,
    created_at: now(),
    updated_at: now(),
  },
];

/**
 * @deprecated Use SEED_DEMAND_GROUPS. Kept for backward compatibility.
 */
export const SEED_CATEGORIES = SEED_DEMAND_GROUPS.map((dg) => ({
  category_id: dg.code,
  name: dg.name,
  name_translations: { de: dg.name, en: dg.name_en ?? dg.name },
  icon: dg.icon ?? "📦",
  default_sort_position: dg.sort_position,
}));
