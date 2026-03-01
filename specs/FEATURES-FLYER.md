# FEATURES-FLYER.md -- Flyer Browser (F14)

> Browse weekly ALDI flyers with interactive product hotspots.
> For PDF import (data processing) see FEATURES-CAPTURE.md.

---

## Overview

A dedicated section for browsing weekly ALDI flyers. Each PDF page is displayed as an image with interactive hotspots on recognized products. Tapping a hotspot shows the product name, price, and an add-to-list button. Products without a detected position are shown in a fallback list below the page.

### Access
- Flyer icon in navigation
- Route: /[locale]/flyer
- No password protection

---

## Data Model (Permanent)

### Table: flyers

| Field | Description |
|-------|-------------|
| flyer_id | Unique ID |
| title | e.g. "Week 09 -- Specials from Feb 24" |
| valid_from | Valid from date |
| valid_until | Valid until date |
| country | 'DE' or 'AT' |
| pdf_url | URL of original PDF |
| total_pages | Number of pages |
| status | active / expired |
| created_at | Upload timestamp |

### Table: flyer_pages

| Field | Description |
|-------|-------------|
| page_id | Unique ID |
| flyer_id | Reference to flyers |
| page_number | Page number |
| image_url | URL of page PDF in storage |

### Table: flyer_page_products (Junction Table)

Single source of truth for which products appear on which flyer page.

| Field | Description |
|-------|-------------|
| flyer_id | Reference to flyers (FK, CASCADE) |
| page_number | Page number (1-based) |
| product_id | Reference to products (FK, CASCADE) |
| price_in_flyer | Price as shown in the flyer |
| bbox | JSONB: {x_min, y_min, x_max, y_max} normalized 0-1000; null if unknown |
| created_at | Timestamp |

PK: (flyer_id, page_number, product_id). This allows many-to-many: one product can appear on multiple pages/flyers, and one page can have many products.

### Deprecated: products.flyer_id / products.flyer_page

These columns on the products table are deprecated. They stored a 1:1 relationship (one product belongs to one flyer page) which breaks when the same product appears in multiple flyers. The `flyer_page_products` junction table replaces them. The old columns remain in the schema but are no longer written to.

---

## UI: Flyer Overview (/[locale]/flyer)

- Sorted by date (newest first)
- Each flyer shows title, validity period, first page as preview (full width)
- Expired flyers greyed out
- Tap -> detail view

## UI: Flyer Detail View (Permanent)

- All pages stacked vertically, scrollable
- Pinch-to-zoom on page images
- **Interactive product hotspots** overlaid on each page image:
  - Semi-transparent bordered rectangles on detected product areas
  - First tap: shows popup with product name, price, and [+] button
  - Second tap or popup button: adds to shopping list
  - Products already on the list show a green checkmark indicator
  - Only hotspots with sufficient size (>= 8% of page dimension) are rendered
- **Fallback product list** below each page for products without bbox or with too-small bbox:
  - Heading: "More products on this page" (when hotspots exist) or "Products on this page" (when no hotspots)
  - Hidden when all products have hotspots
  - Shows price_in_flyer (falling back to product.price)
- Page PDFs rendered client-side with pdfjs-dist, converted to WebP blob URLs on first view, then displayed as `<img>` tags; PDF documents are destroyed immediately after conversion to keep memory low
- Blob URLs are cached per session so re-scrolling reuses the already-rendered image without re-fetching
- Lazy loading via IntersectionObserver (200px rootMargin); pages outside the viewport show a placeholder

---

## Data Acquisition: Workaround (Two-Model Pipeline)

> **This section describes a temporary workaround.**
> It will be replaced once structured retailer data feeds are available.
> The workaround code is isolated in the processing files and has no
> dependency on the permanent feature layer (UI, flyer-service).

### How it works

1. PDF upload via Admin Gallery Upload (see FEATURES-CAPTURE.md)
2. `processFlyer` splits the PDF into single-page PDFs, stores them in `flyer-pages` bucket
3. Each page is processed by a two-model pipeline running in parallel:
   - **Gemini (gemini-2.5-flash)**: Detects product bounding boxes with high spatial accuracy. Returns `[y_min, x_min, y_max, x_max]` normalized 0-1000.
   - **Claude (Sonnet)**: Extracts product data (name, price, metadata). No longer responsible for bounding boxes.
4. Gemini bboxes are matched to Claude products by label similarity (`matchBboxesToProducts`)
5. Products are upserted via `upsertProduct` (matching by article_number -> ean_barcode -> name_normalized)
6. Product-page associations + matched bbox are written to `flyer_page_products` junction table

### Architecture

- `gemini-detect.ts`: Gemini client for bbox detection (`detectProductBoxes`) and label matching (`matchBboxesToProducts`)
- `prompts.ts`: Claude prompt templates (no bbox instructions)
- `process-flyer.ts`: Pages 1-5 processing (Gemini + Claude parallel per page)
- `process-flyer-page/route.ts`: Pages 6+ processing (same parallel approach)

### Processing split

- **Pages 1-5**: Processed inline by `processFlyer` via `upsertExtractedProducts`. Page 1 additionally extracts title, validity dates, and country. Gemini runs in parallel with Claude for each page.
- **Pages 6+**: Processed by the client-side processing loop in the flyer detail page, calling `/api/process-flyer-page` for each page sequentially. Gemini and Claude run in parallel per page.

### Env variables

- `ANTHROPIC_API_KEY`: Claude API key (required)
- `GOOGLE_GEMINI_API_KEY`: Gemini API key (optional; if missing, bbox detection is skipped and products have no hotspots)

### Limitations

- Label matching between Gemini and Claude is fuzzy; some products may not get matched to a bbox
- No deduplication across pages if Claude extracts the same product twice with slightly different names
- If Gemini API is unavailable, processing degrades gracefully (no bboxes, but product data still extracted)

### Future replacement

When structured retailer data (API, data feed, or curated import with coordinates) becomes available, a new importer will write directly to `flyer_page_products`. The processing files (`prompts.ts`, `process-flyer-page/route.ts`, `process-receipt.ts`, `gemini-detect.ts`) can then be removed or simplified without touching the feature layer.

---

## Connection to F13

PDF upload happens via photo capture (F13). On import: flyer entry + page splitting + product extraction. The flyer browser only displays data from `flyer_page_products`.

---

*Last updated: 2026-03-01*
