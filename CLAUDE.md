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
- **Supabase** — PostgreSQL, Auth (anonymous-first + email/password), Storage, Realtime
- **Dexie.js** — IndexedDB for offline-first caching
- **next-intl** — i18n (German `de` default, English `en`)
- **Vitest** + **Playwright** — unit/integration and E2E tests
- **Google Gemini** + **Anthropic Claude** — AI vision (product recognition, receipt OCR, flyer parsing)
- **Vercel** — deployment (auto-deploys on `git push` to `master`)

### Data Flow

The app is **offline-first**: the local IndexedDB (Dexie.js) cache is the primary data source. Supabase syncs in the background via a delta-sync module. Users start anonymously; account creation is optional.

```
Browser PWA
├── React UI (Next.js App Router, /src/app/[locale]/)
├── IndexedDB via Dexie.js  (/src/lib/db/)          ← primary data store
├── Sync layer              (/src/lib/sync/)         ← delta-sync to Supabase
└── Service Worker (PWA)                             ← disabled in dev, enabled in prod

Backend
├── Supabase (PostgreSQL, Auth, Storage, Realtime)
├── Vercel API Routes       (/src/app/api/)           ← ~19 serverless endpoints
└── External AI             (Gemini, Anthropic, Replicate/remove.bg)
```

### Key Subsystems

**Search** (`/src/lib/search/`) — 4-stage client-side search pipeline delivering results in <50ms from IndexedDB. No external search service needed. Scoring signals are configurable; see `specs/SEARCH-ARCHITECTURE.md`.

**Sorting** (`/src/lib/sorting/`, `/src/lib/store/`) — Self-learning aisle order. Three levels: pairwise comparisons (per-user), user-store learning, and chain-wide aggregation. Improves automatically from check-off sequences.

**Photo Processing** (`/src/lib/api/photo-processing/`) — Claude Vision and Gemini classify uploaded photos, extract product info, and detect bounding boxes. Background removal via Replicate/remove.bg.

**Auth** (`/src/lib/auth/`) — Anonymous-first flow. Users get a session immediately; email registration merges the anonymous account. Supabase RLS enforces per-user data isolation.

**i18n** — Route-based via next-intl. Locale prefix in URL (`/de/`, `/en/`). Translations in `/src/messages/de.json` and `en.json`.

### Directory Layout

```
src/
├── app/
│   ├── api/                # ~19 serverless API routes (process-photo, process-receipt, etc.)
│   ├── [locale]/           # i18n page routes
│   │   ├── page.tsx        # Home (search + list + store detection)
│   │   ├── catalog/        # Visual product catalog
│   │   ├── capture/        # Photo/receipt upload, barcode scan
│   │   ├── flyer/          # Digital flyer browser
│   │   └── receipts/       # Receipt history & price tracking
├── components/             # React components grouped by feature
├── lib/                    # Core business logic (search, sorting, sync, db, auth, …)
├── hooks/                  # Custom React hooks
├── messages/               # i18n translation files (de.json, en.json)
├── types/                  # TypeScript types (supabase.ts auto-generated)
└── middleware.ts            # i18n routing + auth cookie sync
supabase/migrations/         # 69 SQL migrations
scripts/                     # Data import & batch processing scripts
specs/                       # Feature & architecture documentation (see specs/BACKLOG.md for backlog)
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
UPSTASH_REDIS_REST_URL      # Rate limiting
UPSTASH_REDIS_REST_TOKEN
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
- `BACKLOG.md` — current task backlog

### Reality-check rule
Before executing any task, verify that referenced files, folders, and patterns actually exist in the current codebase. If anything in CLAUDE.md or a slash command prompt does not match the actual project state — missing files, renamed folders, outdated conventions, unexpected structures — STOP and report the discrepancy before proceeding. Never silently assume or work around a mismatch. Say exactly what you expected vs. what you found, and ask how to proceed.

### Custom commands
- `/implement [spec-name]` — read spec, then implement step by step
- `/audit [file-or-folder]` — check code against architecture and conventions
- `/backlog` — review backlog and suggest next item
