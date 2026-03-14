# Photo Processing Overhaul

Multi-phase overhaul of the product photo capture and processing pipeline.

## Changelog

| Date | Phase | Session | Summary |
|------|-------|---------|---------|
| 2026-03-14 | Phase 1 | Planning + Implementation | Analysed complete E2E photo flow (pipeline → API → client → save → storage → display). Planned all 4 phases. Implemented Phase 1: alignment fix. |
| 2026-03-14 | Phase 4 | Unify Capture UX | Unified both photo capture modals to shared GuidedPhotoSlots component. Migrated CreateProductModal from `/api/process-photo` to `/api/analyze-product-photos`. |

## Phase 1: Alignment Fix (DONE — 2026-03-14)

**Problem:** `applyPreCropData()` in `create-thumbnail.ts` applied crop BEFORE rotation, causing white-corner artifacts and misaligned bounding boxes after rotation.

**Root cause:** The AI (Gemini/Claude) returns bbox coordinates relative to the original (unrotated) image. The old code cropped first using those coordinates, then rotated the cropped region. This meant: (a) white corners from sharp's canvas expansion survived into BG removal, and (b) for tilted photos the bbox was misaligned after rotation.

**Fix:** Reversed the order in `applyPreCropData()`:
1. Apply cardinal rotation (90/180/270) on the **full image**
2. Apply tilt correction on the **full image**
3. Transform bbox coordinates into the rotated coordinate system via new `transformBboxForCardinalRotation()`
4. For tilt: scale + offset bbox to account for sharp's canvas expansion
5. Clamp to image boundaries
6. Then crop with padding (20% / min 50px — unchanged)

**Files changed:**
- `src/lib/product-photo-studio/create-thumbnail.ts`:
  - Rewrote `applyPreCropData()` (rotate-first, then transform bbox, then crop)
  - Added exported `transformBboxForCardinalRotation()` — pure function, maps bbox for 0/90/180/270 rotation
  - Added `Bbox` interface (internal)
  - No signature changes to `preCropToProduct()` or `processImageToThumbnail()` — fully backwards compatible
- `src/lib/product-photo-studio/__tests__/create-thumbnail.test.ts`:
  - Renamed "applies crop and rotation together" → "applies rotation before crop — bbox is transformed to rotated coordinates"
  - Added 2 integration tests: rotation 180 preserves dimensions, rotation 270 swaps dimensions
  - Added 7 unit tests for `transformBboxForCardinalRotation()` (all 4 rotations + full-image-bbox edge cases)
  - Total: 23 tests (was 14), all passing

**Verification:**
- `npx vitest run src/lib/product-photo-studio` — 114 tests passed (9 files)
- `npx tsc --noEmit` — no errors
- No API, client, or save-path changes — purely internal pipeline improvement

---

## Phase 2: Gallery Pipeline — Process ALL Photos (DONE)

**Problem:** Only the 1-2 best hero candidates get processed (BG removal, alignment). All other photos (price tags, back, side) are either stored raw or not persisted at all.

**Fix:** All classified non-hero photos are now processed (preCrop → BG removal → composite on 800×800 canvas) and persisted through the full 5-layer stack.

**Files changed:**
- NEW: `src/lib/product-photo-studio/process-gallery.ts` — `processGalleryPhotos()`: iterates non-hero photos, runs `preCropToProduct()` → `removeBackground()` → `compositeOnCanvas(800)`, uses `Promise.allSettled()`, max 4 gallery photos
- `src/lib/product-photo-studio/types.ts` — added `ProcessedGalleryPhoto` interface, optional `galleryPhotos?` on `ProductPhotoStudioResult`
- `src/lib/product-photo-studio/pipeline.ts` — calls `processGalleryPhotos()` in parallel with `extractProductInfo()` + `createThumbnail()` in STEP 2
- `src/app/api/analyze-product-photos/route.ts` — serializes `gallery_photos[]` (index, category, image_base64, format, background_removed) in response
- `src/components/product-capture/hooks/use-product-capture-form.ts` — new `ProcessedGalleryPhotoClient` type + `processedGalleryPhotos` state, populated from API response, passed to save
- `src/components/product-capture/product-capture-save.ts` — ALDI: sends `gallery_photos` in request body; Competitor: uploads each via `uploadCompetitorPhoto()` + `addProductPhoto()`
- `src/app/api/products/create-manual/route.ts` — accepts `gallery_photos`, uploads to `product-gallery` bucket, inserts `product_photos` rows with category + sort_order
- `src/lib/api/schemas.ts` — extended `createManualSchema` with optional `gallery_photos` array (max 4, Zod validated)
- NEW: `src/lib/product-photo-studio/__tests__/process-gallery.test.ts` — 10 tests (hero skip, price_tag category, 4-photo limit, Promise.allSettled resilience, bg removal edge cases)
- `src/lib/product-photo-studio/__tests__/pipeline.test.ts` — 4 new tests (parallel execution, galleryPhotos in result, empty omission, no gallery on suspicious content)

**Test results:** 128 tests passing (10 test files), 0 type errors.

**Remaining:** `photo-upload-section.tsx` UI display of processed gallery photos (deferred — existing photos are already shown via `product_photos` table after save).

---

## Phase 3: Price Tag Isolation (DONE)

**Problem:** Price tags are not cropped/processed specifically; they get the generic product pre-crop which is too loose.

**Fix:** Introduced a `PreCropPhotoType` discriminator (`"price_tag"`) that flows through the entire pre-crop pipeline. Price tags now get a dedicated tighter prompt (1% AI padding, 5% margin, 20px min pad) vs the generic product prompt (3% AI padding, 20% margin, 50px min pad).

**Files changed:**
- `src/lib/product-photo-studio/gemini-bbox.ts` — new `PreCropPhotoType` type; `geminiSmartPreCrop()` and `claudeSmartPreCrop()` accept optional `photoType` param; dedicated `GEMINI_PROMPT_PRICE_TAG` and `CLAUDE_PROMPT_PRICE_TAG` prompts
- `src/lib/product-photo-studio/create-thumbnail.ts` — `PRECROP_MARGIN_PRICE_TAG = 0.05`, `MIN_PAD_PX_PRICE_TAG = 20`; `preCropToProduct()` accepts optional `photoType`, forwards to AI calls and `applyPreCropData()`
- `src/lib/product-photo-studio/process-gallery.ts` — `processOnePhoto()` passes `"price_tag"` to `preCropToProduct()` when category is `"price_tag"`
- `src/lib/product-photo-studio/__tests__/gemini-bbox.test.ts` — 4 new tests (prompt selection for Gemini + Claude, default + price_tag)
- `src/lib/product-photo-studio/__tests__/create-thumbnail.test.ts` — 4 new tests (photoType forwarding, tighter padding assertion)
- `src/lib/product-photo-studio/__tests__/process-gallery.test.ts` — 2 new tests (price_tag passes photoType, product passes undefined)

**Backwards compatible:** All `photoType` parameters are optional; default behavior (product crop) is unchanged. No perspective correction in this phase.

---

## Phase 4: Unify Capture UX (DONE)

**Problem:** CreateProductModal (3 separate inputs: thumbnail, extra, data) and ProductCaptureModal (1 unified multi-select input) used different UX patterns and different API endpoints (`/api/process-photo` vs `/api/analyze-product-photos`).

**Fix:** Both modals now use a shared "Guided Photo Slots" component with three clearly labeled areas:
1. **Produktfoto (Vorderseite)** — required, single capture input, becomes thumbnail
2. **Preisschild** — optional, single capture input for price detection
3. **Weitere Fotos** — optional, multi-select for back/side/barcode

Both flows now send all photos to `/api/analyze-product-photos` (the full AI pipeline with classification, BG removal, gallery processing). The old `/api/process-photo` endpoint remains for backwards compatibility but is no longer actively called.

**Files changed:**
- NEW: `src/components/guided-photo-slots.tsx` — shared `GuidedPhotoSlots` component with `SlotPhoto` and `PhotoSlotPurpose` types
- `src/app/[locale]/capture/use-product-creation.ts` — complete rewrite: removed 3 separate upload flows (thumbnail/extra/data via `/api/process-photo`), replaced with slot-based state (`frontPhoto`, `priceTagPhoto`, `extraPhotos`) and batch analysis via `/api/analyze-product-photos`. Reduced from 531 to ~280 lines.
- `src/app/[locale]/capture/product-photo-section.tsx` — rewrote to delegate to `GuidedPhotoSlots`. Reduced from 123 to ~82 lines.
- `src/app/[locale]/capture/create-product-modal.tsx` — updated props for slot-based interface, added "Analyze" button for explicit AI trigger
- `src/components/product-capture/hooks/use-product-capture-form.ts` — migrated from `photoFiles[]` + `photoPreviews[]` to slot-based state (`frontPhoto`, `priceTagPhoto`, `extraPhotos`). Auto-triggers analysis on photo selection. Maintains `photoFiles` computed property for save compatibility.
- `src/components/product-capture/photo-upload-section.tsx` — rewrote to delegate to `GuidedPhotoSlots`. Reduced from 225 to ~110 lines.
- `src/components/product-capture/product-capture-modal.tsx` — updated to pass slot-based props
- `src/messages/de.json` — added slot labels (`slotFrontPhoto`, `slotFrontRequired`, `slotPriceTag`, `slotPriceOptional`, `slotExtraPhotos`, `slotExtraHint`, etc.) in both `capture.createProduct` and `productCapture` namespaces
- `src/messages/en.json` — same slot labels in English

**Backwards compatibility:**
- `/api/process-photo` endpoint untouched — still works for any remaining callers
- `product-capture-save.ts` unchanged — receives `processedThumbnail`, `processedGalleryPhotos`, and `photoFiles` as before
- ALDI save path (`thumbnail_base64` → `/api/products/create-manual`) works unchanged
- Competitor save path (`uploadCompetitorPhoto` + `addProductPhoto`) works unchanged
- All 950 existing tests pass, 0 type errors

---

## Current State of `product_photos` Table

```sql
CREATE TABLE product_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(product_id) ON DELETE CASCADE,
  competitor_product_id UUID REFERENCES competitor_products(product_id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('thumbnail', 'product', 'price_tag')),
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exactly_one_product CHECK (...)
);
-- Max 5 photos per product (DB trigger)
-- Partial unique indexes: max 1 thumbnail, max 1 price_tag per product
```

## Storage Buckets

| Bucket | Purpose |
|--------|---------|
| `product-thumbnails` | 150x150 JPEG thumbnails (ALDI) |
| `product-gallery` | Gallery photos (both ALDI and competitor) |
| `competitor-product-photos` | Competitor thumbnail uploads |
| `product-photos` | Raw uploads from CreateProductModal |
