# ALDI Data Request – Digital Shopping List App

> Data fields requested from ALDI SÜD / Hofer to power a digital shopping list application.
> Organized by priority tier. All data needed for both DE and AT markets.

---

## Tier 1 – Core Data (Required for basic app functionality)

Without these fields, the app cannot function properly. These are the minimum requirements.

### 1.1 Product Master Data

| # | Field | Example | Format | Why needed |
|---|-------|---------|--------|------------|
| 1 | **Article number** (internal) | 12345 | TEXT | Unique product identification, duplicate detection, receipt-to-product matching |
| 2 | **EAN / Barcode** | 4061462123456 | TEXT (13 digits) | Barcode scanner feature – users scan products to add them to the list |
| 3 | **Product name** | "Fettarme H-Milch 1,5% 1L" | TEXT | Display in search results, shopping list, and receipt matching |
| 4 | **Brand / Private label** | "Milsani" | TEXT | Brand-based search, grouping, distinguishing similar products |
| 5 | **Retail price (EUR)** | 0.99 | NUMERIC | Price estimation for the shopping list total, price tracking over time |
| 6 | **Customer Demand Group** | "Frische & Kühlung" | TEXT | Product categorization and aisle-based sorting in shopping mode |
| 7 | **Customer Demand Sub-Group** | "Weiße Linie" | TEXT | Fine-grained sorting within demand groups for optimal in-store navigation |
| 8 | **Assortment type** | "daily_range" / "special_food" / "special_nonfood" | TEXT / ENUM | Distinguish permanent assortment from weekly specials. Values: `daily_range`, `special_food`, `special_nonfood` |
| 9 | **Private label flag** | true / false | BOOLEAN | Distinguish ALDI/Hofer private labels (Milsani, Lacura, Tandil, …) from external brands (Nivea, Coca-Cola, …) |
| 10 | **Country** | "DE" / "AT" | TEXT (ISO 3166) | Distinguish German (ALDI SÜD) and Austrian (Hofer) product ranges |

### 1.2 Store Master Data

| # | Field | Example | Format | Why needed |
|---|-------|---------|--------|------------|
| 11 | **Store ID** | 12345 | TEXT | Unique store identification |
| 12 | **Street address** | "Musterstraße 12" | TEXT | Store display, GPS matching |
| 13 | **Postal code** | 80331 | TEXT | Location-based store selection |
| 14 | **City** | "München" | TEXT | Store display |
| 15 | **Country** | "DE" / "AT" | TEXT | Market distinction |
| 16 | **GPS coordinates** (lat/lng) | 48.1351, 11.5820 | NUMERIC | Automatic store detection when user arrives at store. If unavailable, can be geocoded from address. |

---

## Tier 2 – Highly Desirable (Significantly improves app quality)

These fields enable key differentiating features like popularity-based search ranking, regional availability, and accurate product distinction.

### 2.1 Product Enrichment

| # | Field | Example | Format | Why needed |
|---|-------|---------|--------|------------|
| 17 | **Sales volume** (units/week) | 1,200 | NUMERIC | Popularity-based ranking in search results – most-bought products appear first |
| 18 | **Pack size / quantity** | "1L", "200g", "6-pack" | TEXT | Distinguish similar products (e.g. "Milch 0,5L" vs "Milch 1L"), display in product details |
| 19 | **Availability scope** | "national" / "regional" | TEXT / ENUM | Show only products available in the user's region |
| 20 | **Region identifier** | "Bayern", "NRW" | TEXT | If regional: which regions carry this product |
| 21 | **Receipt abbreviation** | "BIO H-MI 3,5%" | TEXT | Map receipt line items to products when OCR reads abbreviated names from thermal receipts |
| 22 | **Base price** | "€0.99/L", "€1.98/kg" | TEXT | Price comparison across different pack sizes of the same product |
| 23 | **Price history / effective date** | 2026-02-01 | DATE | Track price changes over time, show "price went up/down" indicators |

### 2.2 Specials & Promotions

| # | Field | Example | Format | Why needed |
|---|-------|---------|--------|------------|
| 24 | **Promotion start date** | 2026-02-12 | DATE | Show when a special becomes available |
| 25 | **Promotion end date** | 2026-02-18 | DATE | Show remaining availability, auto-archive expired specials |
| 26 | **Promotion type** | "weekly_special", "theme_week" | TEXT | Categorize promotions in the specials browser |

### 2.3 Store Enrichment

| # | Field | Example | Format | Why needed |
|---|-------|---------|--------|------------|
| 27 | **Opening hours** | "Mo-Sa 08:00-21:00" | TEXT / JSON | Show whether a store is currently open |
| 28 | **Store layout type / planogram ID** | "Layout A" | TEXT | Improve aisle sorting accuracy if stores with same layout share product placement |

---

## Tier 3 – Nice-to-Have (Enables future features)

These fields are not critical but enable advanced features for future app versions.

### 3.1 Product Media & Details

| # | Field | Example | Format | Why needed |
|---|-------|---------|--------|------------|
| 29 | **Product image URL** (front) | https://cdn.aldi.../milk.jpg | URL | Display product thumbnails in the shopping list and search results. Currently generated via photo capture + AI cropping – official images would be higher quality and more consistent. |
| 30 | **Product image URL** (back) | https://cdn.aldi.../milk-back.jpg | URL | Show nutritional info, ingredients without needing a photo |
| 31 | **Nutrition facts** (per 100g) | kcal: 47, fat: 1.5g, sugar: 4.9g, protein: 3.4g | JSON | Nutrition tracking, "low calorie" / "high protein" filters |
| 32 | **Ingredients list** | "Milch, Vitamin D" | TEXT | Product detail view, allergy checks |
| 33 | **Allergens** | "Contains lactose" | TEXT / ARRAY | Allergen filter, warning indicators on shopping list items |
| 34 | **Bio / Vegan / Vegetarian** | true / false flags | BOOLEAN | Diet-based filtering |
| 35 | **Country of origin** | "Germany" | TEXT | Transparency features, "local products" filter |
| 36 | **Typical shelf life** | 14 (days) | INTEGER | Shopping planning – suggest items that expire soon, meal planning features |
| 37 | **Nutri-Score** | "A" / "B" / "C" / "D" / "E" | TEXT | Quick health indicator display |

### 3.2 Digital Flyer Data

| # | Field | Example | Format | Why needed |
|---|-------|---------|--------|------------|
| 38 | **Weekly flyer PDF** (or page images) | https://cdn.aldi.../flyer.pdf | URL | Display browsable flyer in-app. Currently uploaded manually – automated feed would ensure completeness. |
| 39 | **Structured flyer data** (product ↔ page mapping) | Product X on page 3 | JSON | Show which products are on which flyer page, enable "add to list" directly from flyer view |

### 3.3 Category & Aisle Data

| # | Field | Example | Format | Why needed |
|---|-------|---------|--------|------------|
| 40 | **Aisle/shelf assignment per store** | Product X → Aisle 3 | MAPPING | Optimal shopping route. Currently self-learned via user behavior – official data would provide instant accuracy. |
| 41 | **Product hierarchy** (full taxonomy) | Category → Subcategory → Product | TREE | Richer categorization for browsing and filtering |

---

## Data Delivery Preferences

| Aspect | Preferred | Alternative |
|--------|-----------|-------------|
| **Format** | JSON or CSV | XML, Excel |
| **Delivery** | API endpoint (REST) | Scheduled file export (SFTP, S3) |
| **Frequency** | Daily incremental updates | Weekly full export |
| **Scope** | All ALDI SÜD (DE) + Hofer (AT) | DE-only as starting point |
| **Identifiers** | Article number + EAN as primary keys | |
| **Encoding** | UTF-8 | |
| **Price updates** | Ideally with effective date | At minimum: current price |

---

## Summary

| Tier | Fields | Purpose |
|------|--------|---------|
| **Tier 1 – Core** | 16 fields (10 product + 6 store) | Basic app functionality: search, list, sorting, barcode scan, store detection, private-label distinction |
| **Tier 2 – Highly Desirable** | 12 fields | Popularity ranking, regional availability, receipt matching, promotions |
| **Tier 3 – Nice-to-Have** | 13 fields | Product images, nutrition, allergens, dietary filters, flyer automation, aisle mapping |
| **Total** | **41 fields** | |

---

*Created: 2026-02-23*
