# Product Photo Studio

Multi-stage pipeline for processing product photos (ALDI and competitor). Transforms raw mobile photos into professional product thumbnails and extracts comprehensive product information. Used by the unified `ProductCaptureModal`.

## Pipeline Architecture

```
Client (1-8 photos)
  │
  ├─ PARALLEL GROUP 1 (~3-5s)
  │  ├─ ZBar Barcode Scan (all photos)
  │  └─ Stage 1: Classify Photos (Claude Sonnet)
  │
  ├─ GATE: Content moderation check
  │  └─ Reject non-product photos → status: review_required
  │
  ├─ PARALLEL GROUP 2 (~5-8s)
  │  ├─ Stage 2: Extract Product Info (Claude Sonnet)
  │  └─ Stage 3: Create Thumbnail (Sharp + remove.bg)
  │
  └─ Stage 4: Verify Thumbnail Quality (Claude Haiku)
```

**Total processing time:** ~9-15 seconds per product.

## Files

| File | Lines | Purpose |
|------|-------|---------|
| `types.ts` | ~120 | Interfaces, Zod schemas, type definitions |
| `prompts.ts` | ~110 | AI prompt templates (classify, extract, verify) |
| `pipeline.ts` | ~70 | Orchestrator with parallel execution groups |
| `validate-classify.ts` | ~80 | Stage 1: Content moderation + photo type classification |
| `extract-product-info.ts` | ~115 | Stage 2: Multi-photo product info extraction |
| `create-thumbnail.ts` | ~85 | Stage 3: Photo selection + enhancement + standardization |
| `background-removal.ts` | ~90 | Provider pattern: remove.bg + Claude crop fallback |
| `verify-quality.ts` | ~55 | Stage 4: Thumbnail QA check |

## AI Models

| Stage | Model | Cost/Call |
|-------|-------|----------|
| Classify | Claude Sonnet 4.5 | ~$0.02-0.05 |
| Extract | Claude Sonnet 4.5 | ~$0.03-0.08 |
| Barcode | ZBar WASM | $0 |
| BG Remove | remove.bg API | ~$0.05-0.23 |
| Verify | Claude Haiku 4.5 | ~$0.005 |

## API Endpoint

`POST /api/analyze-product-photos` (unified endpoint, replaces the former `/api/analyze-competitor-photos` and `/api/extract-product-info`)

```json
{
  "images": [
    { "image_base64": "...", "media_type": "image/jpeg" }
  ]
}
```

## Environment Variables

- `ANTHROPIC_API_KEY` (required) — Claude API access
- `REMOVE_BG_API_KEY` (optional) — remove.bg for background removal; falls back to Claude-guided crop

## Testing

```bash
npx vitest run src/lib/product-photo-studio
```

31 tests across 6 test files covering classification, extraction, thumbnail creation, background removal, verification, and pipeline orchestration.
