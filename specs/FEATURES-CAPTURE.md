# FEATURES-CAPTURE.md – Photo Product Capture (F13)

> Photo upload, receipt scanning, PDF flyer import, review workflow.
> For the flyer browser (display) see FEATURES-FLYER.md.

---

## Overview

Users can photograph or upload product photos, receipts and flyer PDFs. Claude Vision analyzes images and extracts product data. Single products go through a review workflow; receipts and flyers are processed automatically.

### Access
- Camera icon in navigation
- Route: /[locale]/capture
- No password protection

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

### Receipts (Dedicated Scanner)

```
"Kassenzettel scannen" button on capture page
  → Camera opens (rear-facing, 1920×2560)
      - Fallback: native file input (iOS Safari permission issues)
  → User takes one or more photos (long receipts need multiple)
  → Photos resized client-side (max 1600px, JPEG quality 0.7)
  → Photos shown as thumbnail strip, removable
  → "Done" button triggers upload + processing:

Upload flow (avoids 413/CORS issues):
  1. Each photo uploaded individually to /api/upload-receipt-photo
     → Server uploads to Supabase Storage (receipts/{user_id}/)
     → Returns public URL
  2. All URLs sent to /api/process-receipt (tiny JSON payload)
     → Claude receives image URLs directly (source.type: "url")
     → No server-side download needed

Claude extracts full receipt data:
  - Header: store, address, date, time, receipt number, cashier
  - Products: article_number, receipt_name (abbreviation), quantity,
    unit_price, total_price, position, weight for weight items, tax category
  - Footer: total amount, payment method, tax details, extra info
  - Multiple photos: Claude combines overlapping sections automatically

  → Receipt + items saved to receipts / receipt_items tables (per user)
  → Products matched by article_number → name_normalized
  → Product prices updated if receipt date is newer than price_updated_at
  → Receipt products feed into "Letzte Einkäufe" suggestions (see FEATURES-CORE.md)
  → Success screen shows summary (store, date, total, items count, prices updated)
  → Link to receipt detail view (/receipts/{receipt_id})
```

Receipt history available at /receipts – lists all scanned receipts by date with total amount. Detail view shows all products: linked products show their full DB name (bold, with ✓ badge), unlinked products show the receipt abbreviation (monospace, smaller).

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

"Create Product" button on capture page opens fullscreen form:

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

*Last updated: 2026-03-01*
