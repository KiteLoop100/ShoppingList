# ARCHITECTURE.md – Technical Architecture

> Primarily for the AI agent (Cursor). Describes technical guardrails.
> For business logic see the other spec files.

---

## 1. Architecture Principles

| Principle | Description |
|-----------|-------------|
| **Modular** | Each component (search, sorting, sync, DB) has a clear interface and can be replaced independently |
| **API-First** | Backend provides a clean REST API. Frontend and backend are strictly separated |
| **Self-Learning** | Algorithms improve automatically with usage data. Minimal manual intervention |
| **Scalable** | Architecture works from 1 user to thousands without fundamental rebuild |
| **Easy Start** | Prefer managed services. No own server, no DevOps overhead |

---

## 2. Technology Stack

### 2.1 Frontend

| Technology | Role | Rationale |
|------------|------|-----------|
| **Next.js 14** | Web framework | Huge AI training data → AI can generate this code best. SSR + Static Generation |
| **React** | UI library | Component-based, part of Next.js |
| **Tailwind CSS** | Styling | Utility-first, AI can implement precise designs |
| **PWA** | App format | Installable on smartphone, no app store needed |
| **next-pwa** | PWA plugin | Service worker, manifest integration |
| **IndexedDB (Dexie.js)** | Local storage | Structured browser storage for offline (Phase 2) |
| **next-intl** | i18n | Routing, formatting, language files |

### 2.2 Backend

| Technology | Role | Rationale |
|------------|------|-----------|
| **Supabase** | Backend-as-a-Service | PostgreSQL + Auth + Realtime + REST API + Storage. Free start |
| **Supabase Auth** | Authentication | Anonymous auth (for anonymous-first model) + email/password (later) |
| **Supabase Storage** | File storage | Product photos, thumbnails, flyer pages |
| **Vercel Serverless Functions** | Server logic | Photo processing, Claude API calls |
| **Gemini AI** (`@google/genai`) | AI/Vision | Product photo analysis, receipt scanning, flyer processing, category assignment |
| **PostgreSQL** | Database | Relational DB with JSON support. Part of Supabase |

### 2.3 Hosting & Deployment

| Technology | Role | Rationale |
|------------|------|-----------|
| **Vercel** | Hosting | Optimized for Next.js. Auto-deploy on git push. Free start. Global CDN |
| **GitHub** | Version control | Repository: KiteLoop100/ShoppingList |

### 2.4 Active Extensions

| Technology | Role | Status |
|------------|------|--------|
| **Supabase Auth** | Email/password + anonymous auth | Active (Block 0) |
| **Supabase Realtime** | Live sync for multi-device shopping list | Active (with Account feature) |
| **Sentry** | Error tracking and monitoring | Active (Block 4) — config files present (`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`) |
| **@upstash/ratelimit** | API rate limiting | Active (Block 3) |
| **zod** | API input validation | Active (Block 3) |

### 2.5 Later Extensions

| Technology | Role | When |
|------------|------|------|
| **Capacitor** | Native app wrapper | Phase 4 |
| **Elasticsearch / Algolia** | External search | If local-first search insufficient at scale (see SEARCH-ARCHITECTURE.md) |
| **Redis** | Caching layer | If performance issues at scale |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    USER DEVICE                            │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Next.js PWA (Frontend)                 │  │
│  │                                                     │  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────────┐ │  │
│  │  │ UI Layer │ │ Search   │ │ Sort Engine        │ │  │
│  │  │ (React + │ │ Module   │ │ (Aisle Order       │ │  │
│  │  │ Tailwind)│ │          │ │  Calculation)      │ │  │
│  │  └──────────┘ └──────────┘ └────────────────────┘ │  │
│  │                                                     │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │         Sync Layer                            │  │  │
│  │  │  • Supabase REST API                         │  │  │
│  │  │  • Real-time updates (later for family sync) │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
│                          │                                │
└──────────────────────────┼────────────────────────────────┘
                           │ HTTPS / REST API
                           │
┌──────────────────────────┼────────────────────────────────┐
│                    SUPABASE (Cloud)                         │
│                          │                                 │
│  ┌───────────────────────┼──────────────────────────────┐ │
│  │              REST API / PostgREST                     │ │
│  └───────────────────────┼──────────────────────────────┘ │
│                          │                                 │
│  ┌────────────┐  ┌──────┴───────┐  ┌─────────────────┐   │
│  │ Auth       │  │ PostgreSQL   │  │ Storage          │   │
│  │            │  │              │  │                  │   │
│  │ • Anon     │  │ • Users      │  │ • product-photos │   │
│  │ • Email    │  │ • Products   │  │   (public)       │   │
│  │            │  │ • Lists      │  │ • receipt-photos │   │
│  │            │  │ • Stores     │  │   (private)      │   │
│  │            │  │ • Trips      │  │ • product-thumbs │   │
│  │            │  │ • Flyers     │  │ • flyer-pages    │   │
│  └────────────┘  └──────────────┘  └─────────────────┘   │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Vercel Serverless Functions                          │ │
│  │  • /api/process-photo (Gemini Vision)                 │ │
│  │  • /api/confirm-photo                                │ │
│  │  • /api/process-flyer-page                           │ │
│  │  • /api/analyze-product-photos (Photo Studio)        │ │
│  │  • /api/process-receipt (SSE stream)                 │ │
│  │  • /api/feedback, /api/admin/* + 10 more             │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

---

## 4. Modular Architecture – Interfaces

### 4.1 Search Module
Interface: SearchModule
Input:  query (string), user_id? (string), limit? (number), products? (Product[])
Output: SearchResult[] = { product_id, name, category, price, score, matchType, source }
Architecture: 4-stage local-first pipeline

Input Preprocessing (normalization, prefix/suffix stripping, plural stemming)
Candidate Retrieval (11-level match type hierarchy with word boundary analysis)
Scoring Engine (5 weighted signals: match quality, popularity, personal, preferences, freshness)
Post-Processing (allergen exclusion, expired specials removal, limit)

All processing runs client-side (< 50ms target). Server fallback only when IndexedDB is empty.
Full specification: specs/SEARCH-ARCHITECTURE.md

### 4.2 Sort Module (Aisle Sorting)
```
Interface: SortModule
  Input:  items (ListItem[]), store_id (string | null)
  Output: SortedListItem[] = items with calculated sort_position

MVP: Local calculation based on pairwise comparison data
Later: Server-side calculation for more complex algorithms
```

### 4.3 Category Assignment Module
```
Interface: CategoryAssigner
  Input:  product_name (string)
  Output: { demand_group_code: string | null }

Implementation: 3-stage fallback chain
  1. AI hint (from caller context, e.g. receipt OCR or photo extraction)
  2. Keyword-based fallback (getDemandGroupFallback — ~40 patterns
     mapped to demand group codes, src/lib/products/demand-group-fallback.ts)
  3. Gemini API (/api/assign-category — ~90% accuracy)

Used for both ALDI products and competitor products.
Service: src/lib/competitor-products/categorize-competitor-product.ts
```

### 4.4 Validation Module (Check-Off Sequences)
```
Interface: SequenceValidator
  Input:  CheckoffSequence
  Output: { is_valid: boolean, confidence: number, reason: string }

MVP: Rule-based (time gaps, total duration)
Later: ML model for pattern recognition
```

---

## 5. Database Schema Guidelines

- All tables have `id` (UUID), `created_at`, `updated_at`
- Soft delete where appropriate (status active/inactive)
- Indexes on all fields used in WHERE clauses or JOINs
- Row-Level Security (RLS): users only see their own data
- Aggregations pre-computed and cached

---

## 6. API Design

### 6.1 Endpoints

The API uses task-oriented routes (not REST CRUD). List and store operations use Supabase client directly (no API routes).

```
Products:
  GET    /api/products/search?q={query}&country={DE|AT}&limit={20}   Product search (Supabase)
  POST   /api/products/create-manual                                  Create/update product (auth required)

Photos & Vision:
  POST   /api/process-photo              Process photo/PDF (Gemini Vision)
  POST   /api/confirm-photo              Confirm review result
  POST   /api/analyze-product-photos     Unified product photo analysis (multi-image pipeline)
  POST   /api/analyze-competitor-photos  Competitor product photo analysis
  POST   /api/apply-thumbnail-overwrites Apply pending thumbnail overwrites

Receipts:
  POST   /api/upload-receipt-photo       Upload receipt photo → Storage URL (auth required)
  POST   /api/process-receipt            Process receipt via Gemini Vision (SSE stream)

Flyers:
  POST   /api/process-flyer-page         Process single flyer page
  GET    /api/flyer-processing-status    Check flyer processing progress (admin)
  PATCH  /api/flyer-country              Update flyer country

Categories:
  POST   /api/assign-category            AI demand-group assignment (Gemini)

Feedback:
  POST   /api/feedback                   Submit user feedback (rate-limited: 10/day)
  GET    /api/feedback                   List feedback with filters (admin)
  PATCH  /api/feedback                   Update feedback status (admin)

Admin:
  POST   /api/admin/login                Password login → session cookie
  GET    /api/admin/check                Verify admin session

Debug:
  POST   /api/debug-log                  Debug relay (no auth — remove before launch)
```

Note: List operations (add/remove/check-off items), store queries, and aisle order calculation are handled client-side via Supabase client + IndexedDB. No API routes exist for these.

### 6.2 Rate-Limiting & Input Validation

**Implemented (Block 3):** Upstash Redis rate-limiting + Zod schema validation.

- **Rate-Limit Helper:** `src/lib/api/rate-limit.ts`
- **Upstash Redis** via `@upstash/ratelimit` + `@upstash/redis`
- **AI endpoints** (process-receipt, process-photo, assign-category, analyze-product-photos, analyze-competitor-photos): 50 requests/hour/user (sliding window) — testing phase; reduce to 5-10/h before public release
- **General endpoints** (upload-receipt-photo, process-flyer-page, products/create-manual, confirm-photo, flyer-country, apply-thumbnail-overwrites, flyer-processing-status): 20 requests/minute/user (sliding window)
- **Feedback endpoint:** 10 requests/day/user
- **Admin login:** 5 attempts/15 minutes
- **Admin routes** (`/api/admin/check`): No rate limiting (session-protected)
- **Graceful degradation:** When `UPSTASH_REDIS_REST_URL` is not set (local dev), rate limiting is skipped
- **Zod validation:** Most API routes validate input with typed Zod schemas. Invalid payloads → HTTP 400 with structured error details
- **Client-side:** Receipt scanner and capture components show localized 429 error messages
- **Env vars required:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

### 6.3 Authentication

**Implemented (Block 0):** Supabase Auth with anonymous-first + email/password registration.
- `AuthProvider` in `src/lib/auth/auth-context.tsx` wraps the entire app
- `signInAnonymously()` on first app start → immediate usage without sign-up wall
- Optional email/password registration for multi-device sync via `linkEmail()` (anonymous → registered upgrade)
- `getCurrentUserId()` returns `auth.uid()` — replaces old `getDeviceUserId()`
- `getDeviceUserId()` in `src/lib/list/device-id.ts` is **deprecated** (kept for data migration only)
- Shopping list data (lists, items, trips) now lives in **Supabase** (not IndexedDB)
- IndexedDB (Dexie) remains for: products, demand_groups, stores, aisle_orders, pairwise_comparisons (read-only caches, delta-synced)
- Supabase Realtime subscription on `list_items` for live multi-device sync
- One-time data migration in `src/lib/auth/auth-helpers.ts`: IndexedDB → Supabase + old device-ID reassignment
- Login page: `src/app/[locale]/login/page.tsx`
- Full specification: **[FEATURES-ACCOUNT.md](FEATURES-ACCOUNT.md)**
- Security items: All resolved — see `archive/SECURITY-BACKLOG.md`

---

## 7. Frontend Architecture

### 7.1 Folder Structure

```
/src
  /app
    /[locale]              ← Language prefix (de, en)
      /page.tsx            ← Home / shopping list (S1)
      /capture/            ← Photo capture (F13)
      /flyer/              ← Flyer browser (F14)
      /catalog/            ← Product catalog (F29)
      /feedback/           ← Customer feedback (F25)
      /receipts/           ← Receipt history
      /login/              ← Login / registration
      /privacy/            ← Privacy policy
      /settings/           ← Settings (F12)
      /admin/              ← Admin (password-protected)
    /api/                  ← Serverless functions

  /components
    /search                ← Search module
    /list                  ← List view, list items
    /store                 ← Store creation dialog
    /catalog               ← Product catalog
    /product-capture       ← Product capture modal
    /feedback              ← Feedback forms
    /onboarding            ← Onboarding screens
    /common                ← Buttons, icons, layout
    /ui                    ← Base UI components

  /lib
    /supabase              ← Supabase client setup
    /db                    ← IndexedDB / Dexie.js (offline cache)
    /list                  ← Checkoff, pairwise, archive, auto-reorder
    /store                 ← Hierarchical order, store detection, GPS
    /search                ← Search pipeline (see SEARCH-ARCHITECTURE.md §10)
    /products              ← Normalization, dedup, demand groups
    /api/photo-processing  ← Gemini Vision pipeline
    /product-photo-studio  ← Background removal, thumbnails
    /auth                  ← Auth context, anonymous-first
    /receipts              ← Receipt parsing, merge
    /flyers                ← Flyer service
    /competitor-products   ← Competitor product handling
    /retailers             ← Retailer registry
    /categories            ← Demand group service, colors
    /settings              ← Settings sync
    /utils                 ← Logger, formatting, ID generation

  /messages
    /de.json               ← German translations
    /en.json               ← English translations

  /types                   ← TypeScript definitions
```

### 7.2 Responsive Design Architecture

**Breakpoints:** Standard Tailwind defaults (md: 768px, lg: 1024px). No custom breakpoint configuration.

**Input Detection:**
- CSS: `@media (pointer: fine)` for mouse/trackpad, `@media (pointer: coarse)` for touch. Custom Tailwind variants `pointer-fine:` and `pointer-coarse:` configured in `tailwind.config.ts`.
- JS: `usePointerType()` hook in `src/hooks/use-pointer-type.ts` — returns `"fine"` or `"coarse"`, reacts live to device changes (e.g. iPad connecting a trackpad).
- `useBreakpoint()` hook in `src/hooks/use-breakpoint.ts` — returns `"mobile"`, `"tablet"`, or `"desktop"` for conditional rendering decisions.

**Component Strategy:** CSS-only responsive where possible (breakpoint classes on existing elements). Conditional rendering only for structural differences (e.g. Split-View vs. single column). No separate desktop components — one component handles all viewports.

**Gesture / Interaction Duality:** Touch gestures (swipe, long-press, pinch) coexist with mouse alternatives (hover actions, right-click, scroll-wheel zoom). Both are active simultaneously on hybrid devices. Progressive enhancement — desktop adds alternatives, never removes touch support.

**Code Splitting:** Desktop-specific panels (Split-View, Master-Detail) use `next/dynamic` imports so the mobile JS bundle doesn't grow.

### 7.3 State Management
- Local React state for UI (search mode, picker open, etc.)
- **Supabase (source of truth):** Shopping lists, list items, trips, receipts, auto-reorder settings, user settings, feedback
- **IndexedDB (read-only cache):** Products, demand groups, stores, aisle orders, pairwise comparisons — delta-synced from Supabase
- **Supabase Realtime:** Live sync on `list_items` for multi-device shopping list. See FEATURES-ACCOUNT.md section 3.
- No global state manager (Redux etc.)

---

## 8. Deployment & Operations

### 8.1 Pipeline
```
Developer (Cursor) → Git Push → GitHub → Vercel (auto-deploy)
                                          ↓
                                   Production URL
```

### 8.2 Environments
- **Development:** Local with `next dev` (port 3000)
- **Preview:** Auto for every git branch (Vercel)
- **Production:** Master branch → production deployment

### 8.3 Limits (Vercel Pro Plan – active)
- Unlimited deployments
- 60s serverless function timeout (300s with `maxDuration`)
- Preview deployments per branch (for testing before production)
- Password protection for preview URLs

### 8.4 Monitoring
- **Active:** Vercel built-in analytics, Supabase dashboard
- **Active:** Sentry error tracking (`@sentry/nextjs`) – client, server, and edge configs. Global error boundary (`global-error.tsx`). All Claude-calling API routes report exceptions.
- **Active:** Gemini API budget monitoring (limit set in Google Cloud dashboard)

---

## 9. Performance Budget

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 2s |
| Lighthouse Performance | > 90 |
| Bundle size (JS, gzipped) | < 200 KB |
| Search latency (local) | < 50ms |
| List render (100 products) | < 50ms |

---

## 10. Conventions for AI Agent

### 10.1 Code Quality
- TypeScript strict mode
- ESLint + Prettier
- Comments in English
- Functional React components (no classes)
- No `any` types

### 10.2 Naming
- Files/folders: kebab-case (`store-picker.tsx`)
- React components: PascalCase (`StorePicker`)
- Functions/variables: camelCase (`getStoreById`)
- DB tables/columns: snake_case (`aisle_order`)
- Constants: UPPER_SNAKE_CASE (`MAX_SEARCH_RESULTS`)

### 10.3 Commits
- Clear, descriptive messages in English
- One commit per logical change
- Format: `feat: add product search module` / `fix: correct aisle sort order`

### 10.4 Testing
- Core logic (sorting, validation, category assignment) should have unit tests
- UI tests not required in MVP
- Test framework: Vitest

---

*Last updated: 2026-03-10*
*See also: SEARCH-ARCHITECTURE.md, FEATURES-ACCOUNT.md, FEATURES-PLANNED.md*
