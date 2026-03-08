# Backlog Items from Documentation Audit

## Date: 2026-03-07

---

### Code Quality Issues

- [ ] `src/app/api/debug-log/route.ts` — No authentication, no rate limiting, no input validation; writes arbitrary JSON to filesystem. Remove before launch. — Severity: **High**
- [ ] `src/app/api/analyze-competitor-photos/route.ts` — FEATURES-ELSEWHERE.md states this was replaced by the unified `/api/analyze-product-photos`, but the old route still exists and is active. Either remove or document as a separate endpoint. — Severity: **Medium**
- [ ] `src/lib/auth/auth-context.tsx` — Module-level singleton `cachedUserId` violates coding standard "No Module-Level Singletons" — Severity: **Low**
- [ ] `src/lib/search/local-search.ts` — Module-level `let indexedProducts`, `let userHistory`, `let demandGroupMap` violate coding standard. May be intentional for performance caching. — Severity: **Low**
- [ ] `src/lib/db/seed-category-aliases.ts` — Deprecated file still present, `category_aliases` IndexedDB store uses stale `category_id` index from v3 schema — Severity: **Low**
- [ ] `src/types/supabase.ts` — Generated types appear stale: missing columns from recent migrations (`stores.retailer`, `competitor_products.demand_group_code/demand_sub_group/assortment_type/retailer`, `receipts.retailer`). Run `npx supabase gen types typescript` to regenerate. — Severity: **High**

### Missing or Incomplete Documentation

- [ ] 7 API routes completely undocumented: `analyze-competitor-photos`, `flyer-processing-status`, `flyer-country`, `apply-thumbnail-overwrites`, `debug-log`, `admin/check`, `admin/login` — Add to ARCHITECTURE.md §6.1
- [ ] Onboarding flow (`src/components/onboarding/`, 7 screens) — Not mentioned in any FEATURES doc
- [ ] Privacy page (`src/app/[locale]/privacy/`) — Not documented anywhere
- [ ] `src/lib/search/purchase-history.ts` — Not listed in SEARCH-ARCHITECTURE.md §10 file inventory
- [ ] `flyer_page_products` join table — Undocumented in DATA-MODEL.md; links products to flyer pages with bounding box data
- [ ] `batch_jobs` table — Undocumented admin/infrastructure table
- [ ] `user_settings` table — DATA-MODEL.md Section 2 says settings are "stored in localStorage" but a full Supabase table exists
- [ ] No RLS policies or storage buckets documented in DATA-MODEL.md
- [ ] `src/lib/list/` directory has 28+ exported functions/types missing JSDoc — Severity: **Medium**
- [ ] `src/lib/products/` has 9 exported functions missing JSDoc — Severity: **Low**
- [ ] `src/lib/api/photo-processing/` has 7 exported functions missing JSDoc — Severity: **Low**

### Architecture Improvements

- [ ] ARCHITECTURE.md §6.1 documents a theoretical REST API (`/api/products`, `/api/lists/*`, `/api/stores/*`) that was never built. The actual architecture uses direct Supabase client access for list/store operations and task-oriented API routes for photo/receipt processing. — Rationale: Misleads contributors about API design
- [ ] Rate limit documentation says "5 requests/hour/user" for Claude endpoints but actual code has 50/hour (testing phase). Code comment says "reduce to 5-10/h before public release". — Rationale: Pre-launch checklist item
- [ ] ARCHITECTURE.md §2.2 references "Claude API (Anthropic)" but actual AI provider is Gemini (`@google/genai`). All Claude/Anthropic references need updating to reflect Gemini. — Rationale: Major tech stack inaccuracy
- [ ] `@sentry/nextjs` listed as active in ARCHITECTURE.md §2.4 but not in `package.json`. Sentry config files exist but dependency is missing. — Rationale: Either add dependency or remove config files
- [ ] 4 Supabase tables (`aisle_orders`, `aggregated_aisle_orders`, `user_product_preferences`, `sorting_errors`) documented but not in generated types. Either local-only (doc should say so) or missing from schema. — Rationale: Clarify whether these are Supabase tables or local-only

### Potential Bugs or Inconsistencies

- [ ] `search_retailer_products` RPC — Doc says returns `demand_group_code` but generated type returns `category_id` instead. RPC may have been updated without regenerating types. — Severity: **Medium**
- [ ] `list_items.category_id` and `trip_items.category_id` — DATA-MODEL.md says these are "DB-only legacy columns kept in Supabase" but they've been removed from actual schema. Doc is behind actual state. — Severity: **Low**
- [ ] `categories` table — Documented as legacy "remains in place during transition" but appears fully dropped. Archive table `categories_archive_20260227` exists. — Severity: **Low**
- [ ] ARCHITECTURE.md §7.3 — Contradictory statements: "Current (MVP): IndexedDB for shopping list" vs. "Implemented: Shopping list in Supabase". The "Current" label is stale. — Severity: **Low**
- [ ] ARCHITECTURE.md §8.2 — Dev port listed as 3001 but `package.json` shows port 3000 — Severity: **Low**
- [ ] F29 Feature ID collision — FEATURES-CORE.md uses F29 for "Product Catalog", FEATURES-NOTIFICATIONS.md also uses F29 for "Smart Savings Notifications" — Severity: **Low**

### Feature Gaps Discovered

- [ ] FEATURES-FEEDBACK.md marks Admin Feedback Viewer as "Implemented — MVP" but no `admin/feedback/` page exists. Admin GET/PATCH endpoints on `/api/feedback` exist but have no UI. — Discovered: Comparing FEATURES-FEEDBACK.md against src/app/[locale]/admin/
- [ ] F23 (List Item Comments) listed as "Phase 2 / Planned" in Future Features table but is already implemented: `comment` field on ListItem, `item-comment-section.tsx`, `use-item-comment.ts` — Discovered: Comparing FEATURES-CORE.md against src/components/list/
- [ ] FEATURES-CORE.md F02-SS (Semantic Search) reads like documentation of a running system with specific file paths but zero implementation exists. No `input-type-detector.ts`, no `semantic-search-client.ts`, no `/api/semantic-search` route. — Discovered: Comparing affected files list against actual codebase
- [ ] Smart Filter for Catalog (`src/lib/catalog/smart-filter.ts`) not documented in FEATURES-CORE.md F29 section
- [ ] Shopping Tile Grid (`src/components/list/shopping-tile-grid.tsx`) exists but is undocumented
- [ ] Inline Rename (`src/components/list/hooks/use-inline-rename.ts`) exists but is undocumented

### Inline Documentation Issues (JSDoc/TSDoc)

- [ ] `src/lib/search/local-search.ts` — File-level JSDoc says pipeline includes "Classify" step that doesn't exist in code (4 steps, not 5) — Severity: **Medium**
- [ ] `src/lib/search/post-processor.ts` — `shouldExcludeAllergens` references deleted `shouldExclude()` function from `local-search.ts` — Severity: **Low**
- [ ] `src/lib/search/commands.ts` — File-level JSDoc conflates detection with data retrieval and cites wrong data source ("list_items" instead of "receipt_items") — Severity: **Medium**
- [ ] `src/lib/store/hierarchical-order.ts` — `getRetailerStoreIds` JSDoc says "cross-chain" but code does same-chain aggregation — Severity: **Medium**
- [ ] `src/lib/store/hierarchical-order.ts` — `layerWeights` JSDoc says "layer 1" but function returns weights for all three layers — Severity: **Low**
- [ ] `src/lib/store/store-filter.ts` — `filterAndSortStores` JSDoc omits retailer from priority list (retailer is actually highest priority, score 4) — Severity: **Low**
- [ ] `src/lib/api/photo-processing/gemini-detect.ts` — `matchBboxesToProducts` JSDoc says "normalized" map keys but uses raw product names — Severity: **Low**
- [ ] `src/lib/api/photo-processing/image-utils.ts` — `generateFrontThumbnailBuffer` says fallback is "center cover crop" but actual fallback is contain-fit — Severity: **Low**
- [ ] `src/lib/search/scoring-engine.ts` — `scoreAndRank` JSDoc incomplete: omits 3-key sort (totalScore DESC, matchType ASC, name A-Z) and undocumented `now`/`rawQuery` params — Severity: **Low**
