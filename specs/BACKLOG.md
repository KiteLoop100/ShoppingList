# Code Quality & Tech-Debt Backlog

Last updated: 2026-10-24

> Technical debt, security, and architecture items only. For feature requests see [FEATURES-PLANNED.md](FEATURES-PLANNED.md).

## Open Items

| ID | Severity | Category | Short description | Affected files | Notes |
|----|----------|----------|-------------------|----------------|-------|
| BL-59 | medium | security | `claudeRateLimit` steht auf 50 req/h (Testphase). Vor Public Release auf 5-10 req/h reduzieren (Zeile 20). Auch Anthropic API Budget-Limit ($50/Monat) in der Anthropic Console überprüfen. | `src/lib/api/rate-limit.ts` | Pre-Release Task. Seit 2026-10-24 zusätzlich globaler Tages-Cap (`AI_GLOBAL_DAILY_CAP`), siehe BL-78/BL-79. |
| BL-66 | low | tech-debt | **Reverse Geocoding Rate-Limiting.** `reverseGeocode()` in `store-service.ts` nutzt die kostenlose OpenStreetMap Nominatim API (max 1 req/s). Für Produktionsbetrieb Caching oder einen bezahlten Geocoding-Dienst einsetzen. | `src/lib/store/store-service.ts` | Relevant bei hoher Nutzerzahl |
| BL-73 | medium | architecture | **F16 Shared Lists: `display_name`-Snapshot-Problem mitdenken.** Write-Through-Fix für Einzel-Nutzer existiert (2026-03-09). Bei geteilten Listen muss das Muster auf mehrere Nutzer ausgeweitet werden. Robusteste Option: Supabase-Trigger (`AFTER UPDATE ON products → UPDATE list_items`). | `supabase/migrations/`, `src/app/api/products/create-manual/route.ts` | Vor F16-Implementierung entscheiden. |

## Open from Oct 2026 audit

Source: maintenance session 2026-10-24 on branch `maintenance/oct-2026` (audit report, security review of commits `a0a9788`, `0433c17`, `46b8f35`). Audit findings 1, 2, 3, 7 and review findings 1, 2, 5, 7 plus the recipe/extract SSRF, receipt path ownership and stale-sweep items were fixed in those commits. Everything below is still open.

| ID | Severity | Category | Short description | Affected files | Notes |
|----|----------|----------|-------------------|----------------|-------|
| BL-75 | high | rls / data | **Client writes with no matching RLS policy.** Client INSERT into `stores` (only SELECT policy in migrations), client INSERT/UPDATE on `photo_uploads` (policies dropped in `20260226100000`), client UPDATE on `receipt_scans` (SELECT-only policy). Either these writes fail silently in production or policies were added in the dashboard and are missing from `supabase/migrations/`. | `src/lib/store/store-service.ts`, `src/app/[locale]/capture/upload.ts`, `src/app/[locale]/admin/use-gallery-upload.ts`, `src/app/[locale]/capture/capture-status-feed.tsx`, `src/app/[locale]/receipts/receipts-client.tsx` | Audit #5. Pull live policies (`supabase db diff` / MCP `list_tables`) and reconcile: add migrations or move writes behind API routes. |
| BL-76 | medium | error-handling | **Unchecked Supabase write results.** `await supabase.from(...).insert/update(...)` without destructuring `{ error }`, plus `.catch(() => {})`. Combined with BL-75 these fail silently. | `use-gallery-upload.ts`, `receipts-client.tsx`, `src/lib/list/archive-trip.ts`, `src/lib/list/active-list-write.ts` | Audit #24. Destructure `{ error }`, log via `log.warn/error`, add tests per testing-standards. |
| BL-77 | high | security / product | **Shared catalog tables writable by every (anonymous) session.** `products` INSERT/UPDATE `TO authenticated WITH CHECK (true)`; same for `competitor_products`, `competitor_product_prices`, `flyer_page_products`, `product_photos` (incl. DELETE). App is anonymous-first → every visitor is `authenticated`. Client code writes these directly. | `supabase/migrations/*initial_schema*`, `src/app/[locale]/capture/review-card.tsx`, `src/lib/receipts/receipt-service.ts`, `src/lib/competitor-products/competitor-product-service.ts` | Audit #4. **Product decision needed**: (a) keep community-editable catalog and add moderation/ownership columns, or (b) move catalog writes behind API routes with service role + validation and restrict policies. Decide before public release. |
| BL-78 | medium | cost | **Gemini / remove.bg / Replicate calls are not metered.** The global cap is consumed inside `callClaude()` only. In `analyze-product-photos`, `createThumbnail`/`processGalleryPhotos` (Gemini pre-crop + remove.bg/Replicate) start before the first Claude call, and `detectProductBoxes` (Gemini) runs in parallel with Claude in both flyer paths. Peek-then-consume is also TOCTOU: N parallel requests at `remaining=1` all pass the peek. | `src/lib/product-photo-studio/pipeline.ts`, `src/lib/product-photo-studio/background-removal.ts`, `src/lib/api/photo-processing/gemini-detect.ts`, `src/lib/api/ai-budget.ts` | Review #3. Call `consumeGlobalAiCall()` (or a sibling vision counter) inside `detectProductBoxes`, `geminiSmartPreCrop`, `removeBackground`; or consume once up-front and refund on early 4xx. |
| BL-79 | medium | cost / ops | **Provider spend limits not set.** No hard monthly spend limit verified in the Anthropic, Google AI (Gemini), Replicate and remove.bg consoles. The in-app cap (BL-78) is the only cost bound and does not cover non-Claude providers. | — (provider dashboards) | Set hard limits + billing alerts on all four providers; record the values in `.env.example` comments. |
| BL-80 | medium | ops | **Global cap unit is unweighted.** One Haiku categorization per receipt line counts the same as a 16k-token Sonnet flyer page. One receipt with 30 unknown items burns 30 of the default 200/day → legitimate users can exhaust the cap for everyone (availability, not cost). | `src/lib/competitor-products/categorize-competitor-product.ts`, `src/lib/api/rate-limit.ts`, `src/lib/api/ai-budget.ts` | Review #4. Separate caps per model tier (`ai-global:sonnet`, `ai-global:haiku`) or weight calls; raise the default. |
| BL-81 | low | security / ops | **Per-IP layer shares `claudeRateLimit` (50/h) and trusts `x-forwarded-for[0]`.** Safe on Vercel (header overwritten), client-controlled behind any other proxy; missing header → all requests share the `ip:anonymous` bucket. Users behind CGNAT/office NAT are collectively capped at 50 AI calls/h. | `src/lib/api/rate-limit.ts` (`getIdentifier`), `src/lib/api/ai-guard.ts` | Review #6. Prefer `x-vercel-forwarded-for`/`request.ip` with XFF fallback; separate per-IP limiter (e.g. 150/h). Document the platform assumption. |
| BL-82 | low | robustness | **No fetch timeout / body size cap in `fetchAndPreprocessImage`.** A user can upload a bucket-max PDF and have it fully buffered into memory. | `src/lib/api/photo-processing/image-utils.ts` | Review #8. `AbortSignal.timeout(30_000)` and reject `content-length` > N MB before `arrayBuffer()`. Related: `safeFetch` in `src/lib/api/safe-fetch.ts` clears its timer at headers, so the body read in `recipe/extract.ts` is unbounded too (follow-up review issue A). |
| BL-83 | low | testing | **`validateStoragePhotoUrl` tests miss encoding/port cases.** Behaviour is correct by WHATWG URL semantics but not asserted: `%2e%2e/%2e%2e`, `:443` (accept), `:8443` (reject), upper-case host (accept), `host\@evil.com`, trailing-dot host, punycode look-alike, `/Storage/v1/...`. | `src/lib/api/photo-processing/__tests__/validate-photo-url.test.ts` | Review #9. |
| BL-84 | low | performance | **DB work and quota consumption before cheap rejections.** `cook-chat` loads inventory + catalog and `process-photo` runs the ownership `select` before/independent of `enforceAiLimits`; per-user and per-IP quota is consumed for requests that later fail ownership (404). Same for `http://` recipe URLs, which pass Zod and consume four limiter tokens before `extractRecipe` rejects them. | `src/app/api/recipe/cook-chat/route.ts`, `src/app/api/process-photo/route.ts`, `src/app/api/recipe/extract/route.ts` | Review #10 + follow-up issue C. Order checks: cheap existence/ownership first where the limiter is not needed for protection; tighten Zod refine to `^https://`. |
| BL-85 | info | docs | **`.env.example` comment for `AI_GLOBAL_DAILY_CAP`.** Review #11 flagged it as stale ("requests", "4 routes"). Commit `46b8f35` already rewrote it ("Claude API CALLS … across ALL routes"). | `.env.example` | Verify once more and close. |
| BL-86 | medium | dependencies | **Next 16 / React 19 upgrade + `next-pwa` replacement.** `next@14.2.35`, `react@18.3.1`, `next-pwa@5.6.0` (unmaintained, workbox 6, blocks Next 15/16). Breaking: async `cookies()/headers()/params`, `fetch` no longer cached by default, `next lint` removed (16), middleware → `proxy` (16), `ref` as prop, `defaultProps` removed. | `package.json`, `next.config.js`, `src/middleware.ts`, all route handlers reading `params`/`cookies` | Audit #14–16. One branch: Next + React + `eslint-config-next` + `@serwist/next` (new package → approval needed). Gate on green Vitest + a real `playwright.config.ts`. Then `next-intl@4`, `eslint@9` flat config; Tailwind 4 last. |
| BL-87 | medium | ai-api | **Claude model IDs are ~13 months old and duplicated.** `claude-sonnet-4-5-20250929`, `claude-haiku-4-5-20251001` in `config.ts`; scripts duplicate the IDs (`batch-process-photos.ts`, `analyze-store-video.ts`, `review-ai-groups.ts`, `batch-process-flyers.ts` uses `claude-opus-4-6`). Deprecation status to be checked against Anthropic's model-deprecations page. | `src/lib/api/config.ts`, `scripts/*.ts` | Audit #10/#11. Centralise in `config.ts` (env override), make scripts import `callClaude`, re-run prompt/parse suites after switching generation. Gemini IDs (`gemini-2.5-flash/pro`) same treatment (audit #12). |
| BL-88 | low | data / search | **RPC `get_user_purchase_history` does not exist.** `purchase-history.ts` calls `supabase.rpc("get_user_purchase_history")` on every list load; Supabase answers `404 POST /rest/v1/rpc/get_user_purchase_history` and the code falls back to an empty history. No migration defines the function, so purchase-history boosting in search is silently inactive. | `src/lib/search/purchase-history.ts`, `supabase/migrations/` | Found by e2e test (a), tolerated via `KNOWN_STARTUP_RESPONSES` in `tests/e2e/core-flows.spec.ts`. Either add the migration (and remove the allow-list entry) or delete the call and the fallback. |
| BL-89 | low | robustness | **409 race on `getOrCreateActiveList`.** `CurrentCountryProvider` and `useListFetch` both call `getOrCreateActiveList()` on startup; for a known user with no active list both INSERT concurrently, one hits the unique index (`23505`, `409 POST /rest/v1/shopping_lists`) and retries. Functionally harmless but produces a console error on every first load and a wasted round trip. | `src/lib/list/active-list.ts`, `src/lib/current-country-context.tsx`, `src/components/list/hooks/use-list-fetch.ts` | Found by e2e test (a), tolerated via `KNOWN_STARTUP_RESPONSES`. Share one in-flight promise (module cache keyed by user id) or let only `useListFetch` create the list. |
| BL-90 | medium | ux | **Product thumbnails via `/_next/image` return 403 for `dm.emea.cms.aldi.cx` (user-visible broken images).** Not a hotlink/UA issue: the ALDI CDN itself answers 403 for a share of stored `thumbnail_url`s (spot check 2026-10-24: 2 of 40 random active DE URLs, i.e. ~5 % of the 3 893 products on that host; the rest return 200 through `next/image` too). Those assets were removed upstream, `/_next/image` passes the 403 through, and the list/search/catalog show broken thumbnails plus one `Failed to load resource` console error per image. | `src/lib/products/import-helpers.ts` (URL template), `next/image` users: `src/components/list/list-item-row.tsx`, `src/components/search/search-results-panel.tsx`, `src/components/catalog/product-tile.tsx`, `src/components/product-detail/product-header-section.tsx` | Seen in every e2e run. Add an `onError` fallback (placeholder / hide image) in the shared thumbnail rendering, and a maintenance script that HEADs all `thumbnail_url`s and nulls the dead ones (or mirrors live ones into Supabase Storage during flyer import). |
| BL-91 | high | realtime / data | **`list_items` was never added to the `supabase_realtime` publication → no live multi-device list sync.** `use-list-data.ts` subscribes to `postgres_changes` on `list_items`, but the live publication contained only `inventory_items`, `photo_uploads`, `user_settings`; the server answered every join with "Unable to subscribe to changes with given parameters". A second device only saw changes on reload or via the catalog-loaded refetch in `use-list-fetch.ts`. **Fixed in this branch** (`20261024190000_realtime_list_items.sql`: adds the table to the publication **and** sets `REPLICA IDENTITY FULL`, because with the default identity a DELETE event carries only the PK, the `list_id=eq.…` filter cannot be evaluated and deletions never reach other devices; migration still to be applied). Covered by e2e tests (g) add appears live within 5 s on a settled device, (h) no leak to a different anonymous user (RLS), (i) deletion disappears live within 5 s. All three were written first and failed against the unmigrated DB. | `supabase/migrations/20261024190000_realtime_list_items.sql`, `src/components/list/use-list-data.ts`, `tests/e2e/core-flows.spec.ts` | Cost of REPLICA IDENTITY FULL: the full old row is written to WAL on every UPDATE/DELETE of `list_items` (small rows, low write volume → acceptable). Close once the migration is applied and `npm run test:e2e` is green 3×. |

## Documentation debt (merged from root `BACKLOG-FROM-DOC-AUDIT.md`, 2026-03-07)

Open items from the March 2026 documentation audit. **Status not re-verified in Oct 2026**; completed items from the original file were dropped. Code-quality items from that file are superseded by the Oct 2026 audit (module-level singletons: 17 occurrences in `src/lib`, some are deliberate perf caches — amend the coding-standards rule or wrap in cache classes).

### Missing or incomplete documentation
- [ ] 5 API routes undocumented: `flyer-processing-status`, `flyer-country`, `apply-thumbnail-overwrites`, `admin/check`, `admin/login` — add to ARCHITECTURE.md §6.1
- [ ] Onboarding flow (`src/components/onboarding/`, 7 screens) — not mentioned in any FEATURES doc
- [ ] Privacy page (`src/app/[locale]/privacy/`) — not documented
- [ ] `src/lib/search/purchase-history.ts` — not listed in SEARCH-ARCHITECTURE.md §10 file inventory
- [ ] `flyer_page_products` join table — undocumented in DATA-MODEL.md
- [ ] `batch_jobs` table — undocumented; orphaned (no `.from("batch_jobs")` in `src/`), `FOR ALL USING (true)` policy → candidate for a cleanup migration (audit #23, needs confirmation)
- [ ] `user_settings` table — DATA-MODEL.md §2 says settings are "stored in localStorage" but a Supabase table exists
- [ ] No RLS policies or storage buckets documented in DATA-MODEL.md
- [ ] Missing JSDoc: `src/lib/list/` (28+ exports, medium), `src/lib/products/` (9, low), `src/lib/api/photo-processing/` (7, low)

### Architecture docs vs reality
- [ ] ARCHITECTURE.md §6.1 documents a theoretical REST API (`/api/products`, `/api/lists/*`, `/api/stores/*`) that was never built; actual architecture uses direct Supabase client access + task-oriented API routes
- [ ] Rate limit documentation says "5 requests/hour/user" for Claude endpoints; code has 50/h (BL-59)
- [ ] ARCHITECTURE.md §2.2 AI provider description — must reflect reality: **Claude** does all photo/receipt/flyer/recipe extraction, **Gemini** only bounding-box detection. (The original March item claimed the opposite; that claim was wrong.)
- [ ] 4 tables (`aisle_orders`, `aggregated_aisle_orders`, `user_product_preferences`, `sorting_errors`) documented but not in generated types — clarify local-only (IndexedDB) vs Supabase

### Potential inconsistencies
- [ ] `search_retailer_products` RPC — doc says returns `demand_group_code`, generated type returns `category_id` (medium)
- [ ] `list_items.category_id` / `trip_items.category_id` — DATA-MODEL.md calls them "DB-only legacy columns" but they were removed from the schema
- [ ] `categories` table — documented as legacy "remains in place", appears fully dropped (archive `categories_archive_20260227` exists)
- [ ] ARCHITECTURE.md §7.3 — contradictory "Current (MVP): IndexedDB for shopping list" vs "Implemented: Shopping list in Supabase"
- [ ] ARCHITECTURE.md §8.2 — dev port listed as 3001, `package.json` uses 3000
- [ ] F29 feature ID collision — FEATURES-CORE.md (Product Catalog) vs FEATURES-NOTIFICATIONS.md (Smart Savings Notifications)

### Feature gaps in docs
- [ ] FEATURES-FEEDBACK.md marks Admin Feedback Viewer as "Implemented — MVP"; no `admin/feedback/` page exists (API GET/PATCH only)
- [ ] F23 (List Item Comments) listed as "Phase 2 / Planned" but implemented (`comment` field, `item-comment-section.tsx`, `use-item-comment.ts`)
- [ ] FEATURES-CORE.md F02-SS (Semantic Search) reads as implemented but nothing exists (no `input-type-detector.ts`, `semantic-search-client.ts`, `/api/semantic-search`)
- [ ] Undocumented: Smart Filter for Catalog (`src/lib/catalog/smart-filter.ts`), Shopping Tile Grid (`shopping-tile-grid.tsx`), Inline Rename (`use-inline-rename.ts`)

### Inline documentation (JSDoc) issues
- [ ] `local-search.ts` file JSDoc mentions a "Classify" step that doesn't exist (4 steps, not 5) — medium
- [ ] `post-processor.ts` `shouldExcludeAllergens` references deleted `shouldExclude()` — low
- [ ] `search/commands.ts` file JSDoc conflates detection with retrieval and cites `list_items` instead of `receipt_items` — medium
- [ ] `store/hierarchical-order.ts` — `getRetailerStoreIds` says "cross-chain" but does same-chain; `layerWeights` says "layer 1" but returns all three — medium/low
- [ ] `store/store-filter.ts` `filterAndSortStores` omits retailer (highest priority, score 4) — low
- [ ] `gemini-detect.ts` `matchBboxesToProducts` says "normalized" keys but uses raw names — low
- [ ] `image-utils.ts` `generateFrontThumbnailBuffer` says "center cover crop", actual fallback is contain-fit — low
- [ ] `scoring-engine.ts` `scoreAndRank` omits the 3-key sort and `now`/`rawQuery` params — low

## Responsive Desktop & Tablet (F28) — Complete

*No open items — F28 is complete.* See completed RESP-items in [archive/BACKLOG-F28-RESP.md](archive/BACKLOG-F28-RESP.md).

## Completed Backlog

| ID | Category | Resolution |
|----|----------|------------|
| BL-60 | data | Flyer-Daten aktuell, Handzettel nach ALDI-Import neu eingelesen. |
| BL-61 | tech-debt | ZXing durch ZBar WASM ersetzt. |
| BL-62 | architecture | Demand-Groups Migration vollständig abgeschlossen (Phase 1–4). |
| BL-63 | data-quality | Produktkategorie-Datenbereinigung abgeschlossen. |
| BL-64 | architecture | Einheitliches Produkterfassungs-Modul (`ProductCaptureModal`). |
| BL-69 | feature | PWA App Shortcuts implementiert. |
| BL-70 | feature | Produktfotos in der Einkaufsliste. |
| BL-71 | feature | Einkaufsnotizen pro Trip. |
| BL-72 | feature | Retailer Memory. |
| BL-74 | tech-debt | i18n Namespace-Konsolidierung (`competitorDetail` → `productDetail`). |
| 2026-03 doc audit | cleanup | `debug-log` and `analyze-competitor-photos` routes removed, `seed-category-aliases.ts` removed, `supabase.ts` regenerated, Sentry fully removed (2026-03-22). |
| 2026-10 maintenance | security | Audit #1–3, #7 and review #1, #2, #5, #7 fixed: `ai-guard` on all 9 AI routes (auth + per-user/per-IP limits + global Claude cap, fail closed without Upstash), SSRF validation for photo/flyer/recipe URLs, feedback RLS locked down (`20261024150000`), flyer import admin-only, receipt `photo_paths` ownership, retry deadline below `maxDuration`. Commits `a0a9788`, `0433c17`, `46b8f35`. |

See `specs/archive/BACKLOG-2026-03-01-round6-9.md` for the full history of 40+ resolved items from Rounds 1–9.
