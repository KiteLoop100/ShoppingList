# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Digital Shopping List** — An offline-first PWA for intelligent grocery shopping (primarily ALDI Germany/Austria) with AI-powered product recognition, store-specific aisle sorting, and multi-retailer support.

**Important:** This project is a test/prototype. The codebase may be rebuilt from scratch at a future point based solely on the spec files in `/specs/`. Therefore the spec documentation is the primary source of truth — not the code. Keep specs accurate, complete, and up to date at all times.

## Commands

```bash
# Development
npm run dev              # Start dev server (localhost:3000, HTTPS, LAN-accessible)
npm run build            # Production build
npm start                # Run production build locally
npm run lint             # ESLint check
npm run format           # Prettier format (src/**/*.{ts,tsx,json})
npx tsc --noEmit         # TypeScript type-check (run before deployment)

# Testing
npx vitest run           # Run all tests once
npx vitest               # Watch mode
npx vitest --ui          # Browser UI
npx vitest run src/lib/search   # Run tests in a specific folder

# Database scripts
npm run import-stores-DE             # Import ALDI stores from OpenStreetMap
npm run import-stores-AT             # Import Hofer stores (Austria)
npm run import-test-products         # Add test products (dev only)
npx tsx scripts/batch-process-flyers.ts --country DE   # Process flyer PDFs
npx tsx scripts/batch-process-photos.ts --country DE   # Process product photos
npm run analyze-store-video                             # Analyze store walkthrough video
npm run set-store-layout-munich-richard-strauss         # Set aisle layout for Munich store
```

## Architecture

### Technology Stack

- **Next.js 14** (App Router), **React 18**, **TypeScript 5.6**, **Tailwind CSS**
- **Supabase** — PostgreSQL, Auth (anonymous-first + email/password), Storage, Realtime (`postgres_changes` subscriptions on `list_items`, `photo_uploads`, `user_settings`; everything else polls)
- **Dexie.js** — IndexedDB for offline-first caching
- **next-intl** — i18n (German `de` default, English `en`)
- **Vitest** + **Playwright** — unit/integration and E2E tests (Playwright has no `playwright.config.*` yet; specs in `tests/` expect a manually started dev server)
- **Anthropic Claude** — all AI extraction: product photos, receipt OCR, flyer parsing, recipe extraction/matching, cook-chat, insights (`src/lib/api/claude-client.ts`, hand-rolled `fetch` client, no SDK)
- **Google Gemini** — bounding-box detection only (`gemini-detect.ts`, `gemini-bbox.ts`); not used for text extraction
- **Replicate / remove.bg** — background removal for product thumbnails
- **Vercel** — deployment (auto-deploys on `git push` to `master`)

### Data Flow

The app is **offline-first**: the local IndexedDB (Dexie.js) cache is the primary data source. Supabase syncs in the background. There is **no dedicated sync module** — `src/lib/sync/` contains only a README; delta-sync logic lives in the individual services listed below. Users start anonymously; account creation is optional.

```
Browser PWA
├── React UI (Next.js App Router, /src/app/[locale]/)
├── IndexedDB via Dexie.js  (/src/lib/db/)          ← primary data store
├── Sync (per service)      products-context.tsx, settings/settings-sync.ts,
│                           list/active-list*.ts, store/sync-pairwise-from-supabase.ts
└── Service Worker (PWA)                             ← disabled in dev, enabled in prod

Backend
├── Supabase (PostgreSQL, Auth, Storage, Realtime)
├── Vercel API Routes       (/src/app/api/)           ← 22 serverless endpoints (Oct 2026)
└── External AI             (Anthropic Claude, Gemini bbox, Replicate/remove.bg)
```

### Key Subsystems

**Search** (`/src/lib/search/`) — 4-stage client-side search pipeline delivering results in <50ms from IndexedDB. No external search service needed. Scoring signals are configurable; see `specs/SEARCH-ARCHITECTURE.md`.

**Sorting** (`/src/lib/store/aisle-order.ts`, `hierarchical-order.ts`, `/src/lib/list/save-checkoff-and-pairwise.ts`, `list-helpers.ts`) — Aisle order from pairwise comparisons on three layers (user-store, user-chain, chain-wide). **Learning is device-local**: check-off sequences and the pairwise comparisons derived from them are written to IndexedDB only. Supabase `pairwise_comparisons` is seeded by scripts and read-only from the app (`store/sync-pairwise-from-supabase.ts`); `checkoff_sequences` in Supabase is not referenced by `src/`. There is no cross-user aggregation yet. `src/lib/sorting/` is a README-only placeholder.

**Photo Processing** (`/src/lib/api/photo-processing/`, `/src/lib/product-photo-studio/`) — Claude extracts product info from uploaded photos, receipts and flyer pages; Gemini only detects bounding boxes. Background removal via Replicate/remove.bg.

**AI routes & cost guards** (`/src/lib/api/ai-guard.ts`, `ai-budget.ts`, `rate-limit.ts`) — All 9 routes that spend AI budget (`process-photo`, `process-flyer-page`, `process-receipt`, `assign-category`, `analyze-product-photos`, `insights/generate`, `recipe/extract`, `recipe/cook-chat`, `recipe/match-ingredients`) go through `requireAiUser()` + `enforceAiLimits()`: fail closed (503) in production without Upstash, per-user AND per-IP rate limits, and a global daily cap (`AI_GLOBAL_DAILY_CAP`, default 200). The global cap is consumed inside `callClaude()` and therefore **counts Claude calls only** — Gemini, Replicate and remove.bg calls are not metered. Because the app is anonymous-first, `requireAuth()` alone is never a spending guard.

**Flyer import is admin-only** — PDF/flyer uploads (`process-photo` with `is_pdf`, `process-flyer-page`, `flyer-processing-status`) require the admin cookie (`requireAdminAuth` / `isAdminRequest`); `process-flyer-page` accepts uploader OR admin. `scripts/reprocess-all-flyers.mjs` logs in with `ADMIN_PASSWORD` or uses `ADMIN_SESSION_COOKIE`.

**Auth** (`/src/lib/auth/`) — Anonymous-first flow. Users get a session immediately; email registration merges the anonymous account. Supabase RLS enforces per-user data isolation for user-owned tables; shared catalog tables (`products`, `competitor_products`, `product_photos`, …) are writable by every authenticated — i.e. every anonymous — session (see `specs/BACKLOG.md`).

**i18n** — Route-based via next-intl. Locale prefix in URL (`/de/`, `/en/`). Translations in `/src/messages/de.json` and `en.json`.

### Directory Layout

```
src/
├── app/
│   ├── api/                # 22 serverless API routes (process-photo, process-receipt, recipe/*, admin/*, …)
│   ├── [locale]/           # i18n page routes
│   │   ├── page.tsx        # Home (search + list + store detection)
│   │   ├── catalog/        # Visual product catalog
│   │   ├── capture/        # Photo/receipt upload, barcode scan
│   │   ├── flyer/          # Digital flyer browser
│   │   └── receipts/       # Receipt history & price tracking
├── components/             # React components grouped by feature
├── lib/                    # Core business logic (search, store, list, db, auth, api, …)
│                           # NOTE: lib/sorting/ and lib/sync/ are README-only placeholders
├── hooks/                  # Custom React hooks
├── messages/               # i18n translation files (de.json, en.json)
├── types/                  # TypeScript types (supabase.ts auto-generated)
└── middleware.ts            # i18n routing + auth cookie sync
supabase/migrations/         # SQL migrations (74 as of Oct 2026; keep in sync with `npx supabase migration list`)
scripts/                     # Data import & batch processing scripts
specs/                       # Feature & architecture documentation (see specs/BACKLOG.md for backlog)
.claude/commands/            # Claude Code slash commands (/implement, /audit, /backlog) — not available in Cursor
```

### Environment Variables

Required in `.env.local` (see `.env.example` for full list):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
GOOGLE_GEMINI_API_KEY
ADMIN_PASSWORD
ADMIN_SESSION_SECRET        # 64-char hex
UPSTASH_REDIS_REST_URL      # Rate limiting — REQUIRED in production, AI routes return 503 without it
UPSTASH_REDIS_REST_TOKEN
AI_GLOBAL_DAILY_CAP         # Optional, default 200 — global daily cap on Claude calls (all routes, all users)
REPLICATE_API_TOKEN         # OR REMOVE_BG_API_KEY (background removal)
```

## Code Style

Prettier config: 2-space indent, semicolons, double quotes. Path alias `@/*` maps to `src/*`. TypeScript strict mode enabled.

## Coding Conventions

### Patterns to follow
- Business logic lives in service layers (`/src/lib/`), never directly in React components
- Supabase calls go through services, not from UI code
- Every settings change must call `saveSettings()` — localStorage alone breaks cross-device sync
- German product terminology is preserved in data and UI; code, comments, and documentation are in English
- New features get a spec in `/specs/` before implementation begins
- After implementing a feature, update its spec to reflect the final state (the specs must support a full rebuild)
- Spec files should stay under 300 lines; split into separate files if needed
- Pipeline always produces output — never block saving due to processing failure
- Use soft-fallback over classification complexity for rare edge cases

### Git workflow
- Commit after each completed task with a descriptive message
- Work on feature branches (e.g. `feature/xyz`), merge to `master`
- Don't modify existing spec files unless explicitly asked

### What NOT to do
- Don't create new Supabase tables or migrations without confirming first
- Don't refactor patterns that look "clever" — many are deliberate architectural choices
- Don't skip TypeScript strict mode or add `any` types
- Don't install new npm packages without asking first
- Don't touch RLS policies or auth logic without explicit instruction

### Key spec files
- `specs/ARCHITECTURE.md` — overall system design
- `specs/DATA-MODEL.md` — database schema and relationships
- `specs/SEARCH-ARCHITECTURE.md` — 4-stage search pipeline
- `specs/PHOTO-PIPELINE.md` — product photo processing
- `specs/FEATURES-PLANNED.md` — prioritized feature backlog with scoring and detailed specs
- `specs/FEATURES-PHASE2-SPECS.md` — detailed specs for Phase 2 features (F31-F41)
- `specs/BACKLOG.md` — tech-debt, security and documentation backlog (there is no root `BACKLOG.md`)

### Reality-check rule
Before executing any task, verify that referenced files, folders, and patterns actually exist in the current codebase. If anything in CLAUDE.md or a slash command prompt does not match the actual project state — missing files, renamed folders, outdated conventions, unexpected structures — STOP and report the discrepancy before proceeding. Never silently assume or work around a mismatch. Say exactly what you expected vs. what you found, and ask how to proceed.

### Custom commands
Claude Code commands live in `.claude/commands/`, Cursor commands in `.cursor/commands/`; each tool only picks up its own folder. To use a command in the other tool, paste the file's content as a prompt.
- `/implement [spec-name]` (Claude Code) — read spec, then implement step by step
- `/audit [file-or-folder]` (Claude Code) — check code against architecture and conventions
- `/backlog` (Claude Code) — review backlog and suggest next item
- `/feature` (Cursor, `.cursor/commands/feature.md`): turns a product-manager change request into criteria, plan, implementation and test report, with approval stops after criteria and plan.
