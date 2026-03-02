# FEATURES-CAPTURE.md – Photo Product Capture (F13)

> Photo upload, receipt scanning, PDF flyer import, review workflow.
> For the flyer browser (display) see FEATURES-FLYER.md.

---

## Overview

Users can photograph or upload product photos, receipts and flyer PDFs. Claude Vision analyzes images and extracts product data. Single products go through a review workflow; receipts and flyers are processed automatically.

### Access
- **Receipt scanning:** Via "+" button on the Receipts page (/[locale]/receipts), opens scanner directly
- **Create Product:** Via Admin area (/[locale]/admin), in the Products section
- Legacy route /[locale]/capture still exists but is no longer linked from main navigation

---

## Photo Types

| Type | Extracts | Workflow |
|------|----------|----------|
| product_front | Name, brand, weight, price | Review card → Confirm |
| product_back | EAN, nutrition, ingredients, allergens | Review card → Product assignment |
| receipt | Product list with prices, article numbers | Automatic |
| flyer_pdf | Specials with prices, validity period | Automatic |
| shelf | Multiple products with price tags | Review card |
| data_extraction | Barcode, nutri-score, ingredients | Automatic → fill fields |

---

## Workflows

### Single Product Photos (Review Workflow)

```
Take/select photo
  → Upload to Supabase Storage
  → Claude Vision analyzes
  → extracted_data saved to photo_uploads (JSON)
  → Status: pending_review
  → Review card appears immediately:
      - All recognized fields editable
      - Product assignment (match or new)
      - [Confirm] → product written to DB
      - [Discard] → status: discarded
```

### Receipts (Multi-Retailer Scanner)

Supports receipts from ALDI and all competitor retailers defined in `retailers.ts` (LIDL, REWE, EDEKA, Penny, Netto, Kaufland, dm, Rossmann, Spar, BILLA, Hofer, Müller).

```
"+" button on the Receipts page (or legacy capture page)
  → Camera opens (rear-facing, 1920×2560)
      - Fallback: native file input (iOS Safari permission issues)
  → User takes one or more photos (long receipts need multiple)
  → Photos resized client-side (max 1600px, JPEG quality 0.7)
  → Photos shown as thumbnail strip, removable
  → "Done" button triggers upload + processing:

Upload flow (avoids 413/CORS issues):
  1. Each photo uploaded individually to /api/upload-receipt-photo
     → Server uploads to Supabase Storage (receipts/{user_id}/)
     → Returns signed URL
  2. All URLs sent to /api/process-receipt (tiny JSON payload)
     → Claude receives image URLs directly (source.type: "url")
     → No server-side download needed

Claude validates and extracts receipt data:
  - Step 1: Validation
      - Is this a receipt? If not → status "not_a_receipt", HTTP 422
      - Is the retailer supported? If not → status "unsupported_retailer", HTTP 422
      - Valid receipt from supported retailer → status "valid", continue
  - Step 2: Extraction (only for valid receipts)
      - Header: retailer (normalized), store name, address, date, time,
        receipt number, cashier
      - Products: article_number (if present — not all retailers have them),
        receipt_name (abbreviation), quantity, unit_price, total_price,
        position, weight for weight items, tax category
      - Footer: total amount, payment method, tax details, extra info
      - Multiple photos: Claude combines overlapping sections automatically

Retailer detection:
  → Claude returns "retailer" field (normalized to supported list)
  → Server normalizes via normalizeRetailerName() from retailers.ts
  → ALDI SÜD, ALDI Nord, Hofer → normalized to "ALDI"
  → Stored in receipts.retailer column

Product matching (branched by retailer):
  - ALDI receipts:
      → Match against products table by article_number (exact + prefix)
      → Update ALDI product prices if receipt date is newer
      → Set receipt_items.product_id
  - Competitor receipts (LIDL, REWE, etc.):
      → Find or create competitor_products by name_normalized
      → Write price to competitor_product_prices (retailer, price, date)
      → Set receipt_items.competitor_product_id
      → Upsert competitor_product_stats for search ranking

  → Non-product lines (PFAND, LEERGUT, EINWEG etc.) filtered before matching
  → Article numbers normalized before matching (non-digits stripped, leading
    zeros removed) — mirrors PG trigger on products table.
  → Receipt products feed into "Letzte Einkäufe" suggestions (ALDI only,
    see FEATURES-CORE.md)
  → Competitor products from scans automatically appear in retailer
    prefix searches (see SEARCH-ARCHITECTURE.md)
  → Success screen shows summary with retailer badge, store name, date,
    total, items count, prices updated
  → Link to receipt detail view (/receipts/{receipt_id})

Rejection handling:
  - "not_a_receipt": User sees "Das scheint kein Kassenzettel zu sein."
  - "unsupported_retailer": User sees "Der Händler wird noch nicht unterstützt."
    with list of supported retailers.
  - Uploaded photos are cleaned up from storage on rejection.
```

Receipt history available at /receipts – lists all scanned receipts with filter chips by retailer (only retailers with ≥1 receipt shown). Each receipt card shows a colored retailer badge. Detail view shows all products: linked products (ALDI or competitor) show their full DB name (medium weight, with ✓ badge), unlinked products show the receipt abbreviation (smaller text, with ? icon indicating the product could not be matched to the database).

### Flyer PDFs (Automatic, Two-Model Pipeline)

```
Upload PDF
  → Upload to Supabase Storage
  → pdf-lib splits into individual pages
  → Each page processed by two-model pipeline (parallel):
      - Gemini 2.5 Flash: detects product bounding boxes (spatial detection)
      - Claude Sonnet: extracts product data (name, price, metadata)
  → Gemini bboxes matched to Claude products by label similarity
  → First page: additionally extract title + validity period + country
  → Products upserted, associations + bboxes written to flyer_page_products
  → Page PDFs stored in 'flyer-pages' bucket for browser display
```

Pages 1-5 processed inline by processFlyer. Pages 6+ processed by client-side loop calling /api/process-flyer-page per page. See FEATURES-FLYER.md for details on the pipeline architecture.

---

## Manual Product Creation

"Create Product" button in the Admin area (Products section) opens fullscreen form:

### Fields
Name, brand, price, EAN, article number, weight/quantity, demand group (dropdown), demand sub group (filtered dropdown).

### Photo Sections

**a) Front Photo (Thumbnail):** One photo, becomes 150x150 thumbnail. Preview shown.

**b) Additional Photos (back, side):** Multiple allowed, shown as gallery, linked to product.

**c) Data Photos (for recognition):** Multiple allowed (barcode, ingredients, nutri-score). Sent to Claude → fields auto-filled. NOT shown to user in product view. Existing manual entries are not overwritten.

### Save
Duplicate check: EAN → article_number → name_normalized. Duplicate found → ask if update desired. Edit product: same form, pre-filled with existing data.

---

## Demand Group Assignment

All Claude prompts include the complete demand group/sub-group list (from demand-groups-prompt.ts). Fallback: keyword-based assignment (demand-group-fallback.ts). Admin function: "Assign Demand Groups" button processes all unassigned products in batches of 50.

---

## Thumbnail Creation

- Only for photo_type = product_front
- Images resized to max 2000px before Claude upload
- Claude returns product bounding box
- Sharp: crop → resize 150x150 → white background → JPEG
- Upload to 'product-thumbnails' bucket
- Fallback: center crop without bounding box

---

## API Endpoints

- POST /api/process-photo – Process photo/PDF
- POST /api/upload-receipt-photo – Upload single receipt photo to Supabase Storage, returns URL
- POST /api/process-receipt – Process receipt via Claude (accepts photo_urls, returns structured receipt data)
- POST /api/confirm-photo – Confirm review
- POST /api/process-flyer-page – Process single flyer page
- POST /api/admin/assign-demand-groups – Batch assignment

## Storage Buckets

- product-photos (public) – Original photos + receipt photos (receipts/{user_id}/)
- product-thumbnails (public) – 150x150 thumbnails
- flyer-pages (public) – PDF individual pages

---

---

## Security Notes

See [SECURITY-BACKLOG.md](SECURITY-BACKLOG.md) for open security items:
- S1: Receipt photos in public bucket (should use signed URLs)
- S2: receipt_items RLS without user filtering
- S5: No input validation on API routes

---

*Last updated: 2026-03-02*
