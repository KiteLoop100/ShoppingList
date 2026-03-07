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
  │  └─ Stage 3: Create Thumbnail
  │     ├─ Claude Haiku: bounding box detection
  │     ├─ Sharp: pre-crop with 20% margin (min 50px padding)
  │     ├─ remove.bg API (product → auto → crop fallback)
  │     ├─ removeReflections: highlight suppression
  │     └─ Sharp: enhance + composite on white canvas
  │
  └─ Stage 4: Verify Thumbnail Quality (Claude Haiku)
       └─ If backgroundRemovalFailed → forces "review" recommendation
```

**Total processing time:** ~9–18 seconds. Pipeline budget: 28 seconds (verification skipped if budget exhausted).

## Files

| File | Lines | Purpose |
|------|-------|---------|
| `types.ts` | ~131 | Interfaces, Zod schemas, type definitions |
| `prompts.ts` | ~131 | AI prompt templates (classify, extract, verify) |
| `pipeline.ts` | ~133 | Orchestrator with parallel execution groups and 28s timeout |
| `pipeline-runner.ts` | ~159 | Resumable step-by-step execution with state persistence |
| `validate-classify.ts` | ~79 | Stage 1: Content moderation + photo type classification |
| `extract-product-info.ts` | ~125 | Stage 2: Multi-photo product info extraction |
| `create-thumbnail.ts` | ~227 | Stage 3: Photo selection + pre-crop + enhancement + compositing |
| `background-removal.ts` | ~145 | Provider chain: self-hosted → remove.bg → remove.bg-auto → crop fallback |
| `image-enhance.ts` | ~158 | Sharp-based enhancement: reflections, color, sharpness, compositing |
| `verify-quality.ts` | ~112 | Stage 4: Thumbnail QA with explicit background-removal check |

## AI Models

| Stage | Model | Cost/Call |
|-------|-------|----------|
| Classify | Claude Sonnet 4.5 | ~$0.02–0.05 |
| Extract | Claude Sonnet 4.5 | ~$0.03–0.08 |
| Bounding Box | Claude Haiku 4.5 | ~$0.001 |
| Barcode | ZBar WASM | $0 |
| BG Remove | remove.bg API | ~$0.05–0.23/call |
| Verify | Claude Haiku 4.5 | ~$0.005 |

## Background Removal: Provider Chain

Providers are tried in order; the first to succeed wins:

1. **Self-hosted** (`SELF_HOSTED_BG_REMOVAL_URL`) — BiRefNet / RMBG-2.0 via Docker/Replicate
2. **remove.bg `type=product`** — optimised for packaged goods
3. **remove.bg `type=auto`** — fallback for similar-colour packaging
4. **Crop fallback** — sharp crop to bounding box region; sets `backgroundRemovalFailed: true`

All external fetches have a 15-second `AbortSignal.timeout`. If the fallback is used, the pipeline flags `backgroundRemovalFailed` and the verify stage forces a `"review"` recommendation.

## API Endpoint

`POST /api/analyze-product-photos` (unified endpoint)

```json
// Request
{ "images": [{ "image_base64": "...", "media_type": "image/jpeg" }] }

// Response (additional fields)
{
  "status": "ok | review_required",
  "background_removal_failed": false,
  "thumbnail_url": "https://..."
}
```

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes | Claude API (classify, extract, verify, bbox) |
| `REMOVE_BG_API_KEY` | Recommended | remove.bg background removal |
| `SELF_HOSTED_BG_REMOVAL_URL` | Optional | Self-hosted model, tried before remove.bg |

## Testing

```bash
npx vitest run src/lib/product-photo-studio
```

64 tests across 7 test files covering classification, extraction, thumbnail creation, background removal, reflection removal, quality verification, and pipeline orchestration.
