# Foto-Pipeline — Architektur und Datenfluss

## Überblick

Die App verarbeitet Fotos in vier unabhängigen Flows, die jeweils von unterschiedlichen UI-Komponenten und API-Routen gesteuert werden:

| Flow | Zweck | UI-Einstieg | API-Route |
|------|-------|-------------|-----------|
| **Produkt-Foto-Studio** | Produktfotos analysieren, freistellen, Thumbnail erstellen | ProductCaptureModal | `/api/analyze-product-photos` |
| **Capture-Seite** | Manuell Produkte mit Fotos anlegen | CreateProductModal | `/api/process-photo` + `/api/products/create-manual` |
| **Kassenbon-Scanner** | Kassenbons per OCR einlesen | ReceiptScanner | `/api/upload-receipt-photo` + `/api/process-receipt` |
| **Admin-Gallery** | Bulk-Upload von Flyern/Produktfotos | GalleryUploadPanel | `/api/process-photo` |

---

## Flow 1: Produkt-Foto-Studio (Hauptflow)

### UI-Einstiegspunkte

Die `ProductCaptureModal` wird von drei Stellen aufgerufen:

- **Einkaufsliste** (`src/components/list/shopping-list-content.tsx`) — neues Produkt erfassen
- **Produktkatalog** (`src/components/catalog/product-tile.tsx`) — bestehendes Produkt bearbeiten
- **Kassenbon-Detail** (`src/app/[locale]/receipts/[receiptId]/page.tsx`) — Produkt zu Kassenbon zuordnen

### Komponenten-Hierarchie

```
ProductCaptureModal (product-capture-modal.tsx)
 └─ PhotoUploadSection (photo-upload-section.tsx)
     └─ <input type="file" accept="image/*" multiple />
 └─ useProductCaptureForm (use-product-capture-form.ts)  ← Hook mit gesamter Logik
```

### Client-seitiger Ablauf

**Datei:** `src/components/product-capture/hooks/use-product-capture-form.ts`

```
Nutzer wählt Fotos aus
  │
  ├─ 1. setPhotoFiles(files) + setPhotoPreviews(objectURLs)
  │     → Originalfotos werden sofort als Vorschau angezeigt
  │
  ├─ 2. compressImage(file, maxDimension=1600, quality=0.82)
  │     → Canvas-basierte Komprimierung auf max 1600px, JPEG 82%
  │     → Ergebnis: { base64, mediaType }
  │
  ├─ 3. Payload-Validierung: Gesamtgröße ≤ 15 MB
  │
  ├─ 4. POST /api/analyze-product-photos
  │     Body: { images: [{ image_base64, media_type }] }
  │     → AbortController ermöglicht Abbruch bei erneutem Upload
  │
  ├─ 5. Response verarbeiten:
  │     ├─ thumbnail_base64 → setProcessedThumbnail(data:URI)
  │     ├─ extracted_data → Formularfelder füllen (Name, Marke, EAN, Preis, ...)
  │     └─ status=review_required → Warnung anzeigen
  │
  └─ 6. Speichern (handleSubmit):
        ├─ ALDI-Produkt  → saveAldiProduct()  → POST /api/products/create-manual
        └─ Wettbewerber  → saveCompetitorProduct() → Supabase direkt
```

### Server-seitiger Ablauf

**API-Route:** `src/app/api/analyze-product-photos/route.ts`

Akzeptiert `{ images: [{ image_base64, media_type }] }`, leitet an die Pipeline weiter.

**Pipeline:** `src/lib/product-photo-studio/pipeline.ts`

```
processProductPhotos({ images })
  │
  ├─ Phase 1: Klassifikation (parallel)
  │   ├─ scanBarcodesFromAll()     ← ZBar Barcode-Scan aller Fotos
  │   └─ classifyPhotos()          ← Claude Sonnet: Ist es ein Produktfoto?
  │       → Typ (product_front, product_back, price_tag, barcode, shelf, ...)
  │       → Qualitätsscore (0-1)
  │       → is_product_photo, suspicious_content
  │
  ├─ Moderation Gate
  │   └─ Wenn KEIN Foto als Produktfoto erkannt → status: review_required
  │
  ├─ Phase 2: Extraktion + Thumbnail (parallel)
  │   ├─ extractProductInfo()      ← Claude Sonnet: Name, Marke, EAN, Preis, ...
  │   └─ createThumbnail()         ← Siehe "Thumbnail-Pipeline" unten
  │
  ├─ Phase 3: Qualitätsprüfung
  │   └─ verifyThumbnailQuality()  ← Claude Haiku + Sharp
  │       → Wenn Budget überschritten (28s): wird übersprungen
  │       → quality_score, recommendation (accept/review/reject)
  │
  └─ Ergebnis: { status, extractedData, thumbnailFull, thumbnailSmall, ... }
```

**Budget:** Die Pipeline hat ein 28-Sekunden-Timeout (`PIPELINE_TIMEOUT_MS`). Pro Pipeline-Run werden bis zu 6-9 Claude API Calls gemacht.

### Thumbnail-Pipeline im Detail

**Datei:** `src/lib/product-photo-studio/create-thumbnail.ts`

```
createThumbnail(images, classification)
  │
  ├─ 1. Hero-Auswahl
  │     Wählt das beste Foto (product_front mit höchstem quality_score).
  │     Bei Score < 0.75: Top 2 werden parallel verarbeitet, schärferes gewinnt.
  │
  └─ processImageToThumbnail(imageBuffer)
       │
       ├─ 2. Pre-Crop (preCropToProduct)
       │     ├─ Claude Haiku: getProductBoundingBox()  → Crop-Region
       │     ├─ Claude Sonnet: detectTextRotation()    → 0°/90°/180°/270°
       │     └─ Claude Sonnet: detectTiltCorrection()  → Fein-Neigung (±15°)
       │     → Ergebnis: Bild auf Produktbereich zugeschnitten und ausgerichtet
       │
       ├─ 3. Hintergrund-Entfernung (removeBackground)
       │     Provider-Chain (erste erfolgreiche gewinnt):
       │     ┌──────────────────────────────────────────────────────────────────┐
       │     │ 1. Self-hosted (SELF_HOSTED_BG_REMOVAL_URL)                    │
       │     │    BiRefNet/RMBG-2.0 via Docker — kostenlos, unbegrenzt        │
       │     │                                                                 │
       │     │ 2. Replicate API (REPLICATE_API_TOKEN)                         │
       │     │    lucataco/remove-bg — ~0.002€/Bild                           │
       │     │    Version-Hash wird dynamisch aufgelöst und gecacht            │
       │     │                                                                 │
       │     │ 3. remove.bg type=product (REMOVE_BG_API_KEY)                  │
       │     │    50 Credits/Monat kostenlos                                   │
       │     │                                                                 │
       │     │ 4. remove.bg type=auto                                         │
       │     │    Fallback für ähnliche Verpackungs-/Hintergrundfarben        │
       │     │                                                                 │
       │     │ 5. Crop-Fallback (immer verfügbar)                             │
       │     │    Nur Sharp rotate() — KEINE Hintergrund-Entfernung           │
       │     └──────────────────────────────────────────────────────────────────┘
       │     Transparenz-Validierung: 3-97% transparente Pixel → gültig
       │     Clipping-Check: >15% opake Randpixel → Retry ohne Pre-Crop
       │
       ├─ 4. Reflexions-Entfernung (removeReflections)
       │     Erkennt Glanzstellen (near-white Pixel, 0.5-15% Anteil)
       │     → Masked Blur mit dilated Mask
       │     → Alpha-Kanal bleibt erhalten
       │
       ├─ 5. Bildverbesserung (enhanceProduct)
       │     → Median-Filter (3px)
       │     → Helligkeit +5%, Sättigung +12%
       │     → Kontrast: linear(1.05, -6)
       │     → Schärfung: sigma=1.0
       │     → Alpha-Kanal bleibt erhalten
       │
       └─ 6. Compositing (compositeOnCanvas)
             ├─ Full-Size: 1200×1200 WebP (quality 90)
             │   → Produkt auf 80% der Canvas-Fläche
             │   → Optionaler Schlagschatten (bei transparentem BG)
             │   → Weißer Hintergrund
             │
             └─ Thumbnail: 150×150 JPEG (quality 85)
                 → Gleicher Aufbau, ohne Schatten
```

### Speicher-Flow

**ALDI-Produkte:** `saveAldiProduct()` → `POST /api/products/create-manual`
- `thumbnail_base64` (aus Pipeline) wird zu 150×150 JPEG resized
- Upload nach `product-thumbnails/manual/{productId}.jpg`
- Public URL → `products.thumbnail_url`

**Wettbewerber-Produkte:** `saveCompetitorProduct()`
- `processedThumbnail` (data:URI) → Blob → File
- `uploadCompetitorPhoto(productId, file, "front")` → `competitor-product-photos/{productId}/front.jpg`
- Public URL → `competitor_products.thumbnail_url`

---

## Flow 2: Capture-Seite (Manuell)

### UI

**Seite:** `/[locale]/capture` (`src/app/[locale]/capture/page.tsx`)

**Komponenten:**
```
CapturePageClient
 └─ CreateProductModal (create-product-modal.tsx)
     └─ ProductPhotoSection (product-photo-section.tsx)
         ├─ Thumbnail-Input     ← Hauptproduktfoto
         ├─ Extra-Photo-Input   ← Zusätzliche Fotos
         └─ Data-Photo-Input    ← Zutatenlisten, Nährwerte
     └─ useProductCreation (use-product-creation.ts)
```

### Ablauf

```
Nutzer wählt Foto
  │
  ├─ 1. Upload nach Supabase Storage (product-photos Bucket)
  │
  ├─ 2. Insert in photo_uploads (status: pending)
  │
  ├─ 3. POST /api/process-photo { upload_id, photo_url, data_extraction: true }
  │     ├─ fetchAndPreprocessImage() — Bild laden, auf 1600px resizen
  │     ├─ processDataExtraction() — Claude Sonnet Extraktion
  │     └─ Response: { extracted_data, product_created?, product_id? }
  │
  ├─ 4. Formularfelder werden aus extracted_data gefüllt
  │
  └─ 5. Speichern: POST /api/products/create-manual
        Body: { name, brand, thumbnail_url, extra_photo_urls, data_upload_ids, ... }
```

Dieser Flow hat **keine Freistellung** — das Foto wird unverarbeitet als URL referenziert. Die `create-manual`-Route resized es lediglich auf 150×150 für den Thumbnail.

---

## Flow 3: Kassenbon-Scanner

### UI

**Seite:** `/[locale]/capture` (Tab "Kassenbon")

**Komponenten:**
```
ReceiptScanner (receipt-scanner.tsx)
 ├─ ReceiptCameraPhase  — Kamera-Modus
 └─ ReceiptFallbackPhase — Datei-Upload-Modus
```

### Ablauf

```
Nutzer fotografiert Kassenbon (1-3 Fotos)
  │
  ├─ 1. Pro Foto: POST /api/upload-receipt-photo
  │     Body: { base64, index, timestamp }
  │     → Upload nach receipt-photos Bucket
  │     → Response: { url, path }
  │
  ├─ 2. POST /api/process-receipt
  │     Body: { photo_urls: [...], photo_paths: [...] }
  │     → Server-Sent Events (SSE):
  │
  │     Event: progress  → { step: "ocr", message: "Kassenbon wird gelesen..." }
  │     Event: progress  → { step: "matching", message: "Produkte werden zugeordnet..." }
  │     Event: result    → { receipt: { items, retailer, total, date }, matched_products }
  │     Event: error     → { message: "..." }
  │
  └─ 3. Ergebnis wird als Kassenbon gespeichert
        → receipts Tabelle (Gesamtdaten)
        → receipt_items Tabelle (Einzelposten)
        → Produktverknüpfungen über receipt_items.product_id
```

**Keine Thumbnails** — Kassenbons werden nur per OCR gelesen, keine Bildverarbeitung.

---

## Flow 4: Admin-Gallery (Bulk-Upload)

### UI

**Seite:** `/[locale]/admin`

**Komponenten:**
```
AdminClient (admin-client.tsx)
 └─ GalleryUploadPanel (gallery-upload-panel.tsx)
     └─ useGalleryUpload (use-gallery-upload.ts)
```

### Ablauf

```
Admin wählt Bilder/PDFs aus
  │
  ├─ 1. Upload nach product-photos Bucket
  │
  ├─ 2. Insert in photo_uploads { status: pending, photo_type: guessed }
  │
  └─ 3. Fire-and-forget: POST /api/process-photo { upload_id, photo_url }
        │
        ├─ Bild: fetchAndPreprocessImage()
        │   ├─ photo_type=product_front → processVisionPhoto()
        │   │   └─ processImageToThumbnail() → Freistellung + Enhancement
        │   │   └─ Upload nach product-thumbnails Bucket
        │   │   └─ photo_uploads.status = pending_review
        │   │
        │   ├─ photo_type=product_back → processVisionPhoto()
        │   │   └─ enhanceProduct() + compositeOnCanvas()
        │   │   └─ Upload als back-Thumbnail
        │   │
        │   └─ photo_type=shelf/receipt/flyer → processVisionPhoto()
        │
        └─ PDF: processFlyer()
            ├─ PDF → Einzelseiten splitten
            ├─ Jede Seite: Gemini BBox-Detection + Claude Extraktion
            ├─ Produkte: upsertExtractedProducts()
            └─ Flyer-Seiten: Upload nach flyer-pages Bucket
```

---

## API-Route Übersicht

| Route | Methode | Auth | Rate-Limit | Zweck |
|-------|---------|------|------------|-------|
| `/api/analyze-product-photos` | POST | API Key | Claude-Limit | Foto-Studio Pipeline (Hauptflow) |
| `/api/analyze-competitor-photos` | POST | API Key | Claude-Limit | Gleiche Pipeline (Legacy-Alias) |
| `/api/process-photo` | POST | API Key | Claude-Limit | Generische Foto-Verarbeitung |
| `/api/process-receipt` | POST | API Key | Claude-Limit | Kassenbon-OCR (SSE) |
| `/api/upload-receipt-photo` | POST | API Key | General-Limit | Kassenbon-Foto Upload |
| `/api/process-flyer-page` | POST | API Key | Claude-Limit | Einzelne Flyer-Seite verarbeiten |
| `/api/products/create-manual` | POST | User Auth | General-Limit | Produkt anlegen/aktualisieren |
| `/api/confirm-photo` | POST | API Key | General-Limit | Foto-Review bestätigen |
| `/api/apply-thumbnail-overwrites` | POST | API Key | General-Limit | Thumbnail-Überschreibung anwenden |
| `/api/flyer-processing-status` | GET | API Key | — | Flyer-Verarbeitungsstatus |

---

## Externe Dienste

| Dienst | Zweck | Env-Variable | Kosten |
|--------|-------|-------------|--------|
| **Claude Sonnet** | Klassifikation, Extraktion, Rotation, Tilt | `ANTHROPIC_API_KEY` | ~$3/1M Token |
| **Claude Haiku** | BoundingBox, Qualitätsprüfung | `ANTHROPIC_API_KEY` | ~$0.25/1M Token |
| **Gemini** | Flyer BBox-Detection | `GOOGLE_GEMINI_API_KEY` | Kostenlos (bis Limit) |
| **Replicate** | Hintergrund-Entfernung | `REPLICATE_API_TOKEN` | ~0.002€/Bild |
| **remove.bg** | Hintergrund-Entfernung (Fallback) | `REMOVE_BG_API_KEY` | 50 Credits/Monat frei |
| **Self-hosted rembg** | Hintergrund-Entfernung (unbegrenzt) | `SELF_HOSTED_BG_REMOVAL_URL` | Hosting-Kosten |
| **Supabase Storage** | Bild-Speicherung | `SUPABASE_SERVICE_ROLE_KEY` | Im Free-Tier enthalten |
| **ZBar (WASM)** | Barcode-Scan | — | Lokal, kostenlos |

---

## Supabase Storage Buckets

| Bucket | Inhalt | Hochgeladen von |
|--------|--------|-----------------|
| `product-photos` | Originale Produktfotos | Capture-Seite, Admin-Gallery |
| `product-thumbnails` | Verarbeitete 150×150 + 1200×1200 Thumbnails | Pipeline, create-manual |
| `competitor-product-photos` | Wettbewerber-Produktfotos | saveCompetitorProduct |
| `receipt-photos` | Kassenbon-Fotos | upload-receipt-photo |
| `flyer-pages` | Einzelne Flyer-Seiten (PNG) | process-flyer |

---

## Timeouts

| Konstante | Wert | Datei | Zweck |
|-----------|------|-------|-------|
| `PIPELINE_TIMEOUT_MS` | 28s | pipeline.ts | Gesamt-Budget für Pipeline |
| `CLAUDE_TIMEOUT_MS` | 30s | claude-client.ts | Einzelner Claude API Call |
| `EXTERNAL_FETCH_TIMEOUT_MS` | 15s | background-removal.ts | remove.bg, Self-hosted |
| `REPLICATE_TIMEOUT_MS` | 30s | background-removal.ts | Replicate API Call |
| `maxDuration` | 120s | route.ts | Vercel Serverless Function |
