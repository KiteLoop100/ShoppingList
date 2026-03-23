# Project Documentation -- Digital Shopping List

## Files and Responsibilities

| File | Content | ~Lines |
|------|---------|--------|
| **VISION.md** | Why does this product exist? Benefits for customers and ALDI. Strategic compass. | 100 |
| **PRODUCT.md** | Product concept, target audience, design principles | 100 |
| **FEATURES-CORE.md** | F01-F12, F23, F29: Search, shopping list, sorting, store detection, settings, catalog, comments | 150 |
| **FEATURES-PLANNED.md** | Prioritized feature backlog (26 features ranked by Nutzen x Einfachheit). Kassenzettel-Flywheel. Specs for F02-SS, F15, F20, F22, F27. | 200 |
| **FEATURES-PHASE2-SPECS.md** | Detailed specs for Phase 2 features: F31-F41 | 200 |
| **FEATURES-CAPTURE.md** | F13: Photo upload, receipt scan, PDF import, review workflow, manual creation | 217 |
| **FEATURES-FLYER.md** | F14: Flyer browser, add specials to list | 163 |
| **FEATURES-ELSEWHERE.md** | F26: Buy Elsewhere, competitor products, multi-retailer | 213 |
| **FEATURES-ACCOUNT.md** | F17: Accounts, Auth, Multi-Device, IndexedDB-to-Supabase migration | 327 |
| **FEATURES-FEEDBACK.md** | F25: Product, general, and post-shopping feedback | 330 |
| **FEATURES-INVENTORY.md** | F42: Haushaltsinventar (Household Inventory) | 88 |
| **SCAN-AND-GO.md** | F43: Scan & Go (implemented) — unified shopping list + cart, barcode scan, dual-price footer | 120 |
| **FEATURES-NOTIFICATIONS.md** | Notification feature spec (planned) | 524 |
| **FEATURES-INSIGHTS.md** | F24: ALDI Insights analytics (planned) | 368 |
| **FEATURES-ALDI-KUNDEN-UNTERSTUETZUNG.md** | F30: Crowdsourced customer intelligence (planned) | 404 |
| **DATA-MODEL.md** | Core database tables: user, list, product, demand groups, store, trip | 240 |
| **DATA-MODEL-EXTENDED.md** | Extended tables: preferences, competitors, aisle order, photos, receipts, flyers, feedback | 330 |
| **LEARNING-ALGORITHMS.md** | Three-level sorting algorithm, pairwise comparisons | 305 |
| **SEARCH-ARCHITECTURE.md** | Search pipeline overview: preprocessing, candidate retrieval, match types | 313 |
| **SEARCH-SCORING.md** | Search scoring engine: signals, weights, post-processing, configuration | 442 |
| **ARCHITECTURE.md** | Tech stack, project structure, API design, deployment | 340 |
| **PHOTO-PIPELINE.md** | Product photo processing: background removal, thumbnail generation | 297 |
| **UI.md** | Screen designs, interaction patterns, design language | 537 |
| **BACKLOG.md** | Code quality & tech-debt backlog | 40 |
| **IMPROVEMENT-PLAN-V2.md** | Code quality sessions S9-S18 (file sizes, DRY, tests, accessibility) | 100 |
| **OFFLINE-STRATEGY.md** | Offline mode specification (deferred) | 90 |
| **ALDI-DATA-REQUEST.md** | Data request for ALDI: 40 fields in 3 priority tiers | 98 |
| **CHANGELOG.md** | Spec change history (2026-03+) | 513 |

### Archived (in `archive/`)
| File | Content |
|------|---------|
| MVP.md | MVP scope definition (shipped) |
| LAUNCH-READINESS.md | Launch checklist (all blocks complete) |
| SECURITY-BACKLOG.md | Security items S1-S7 (all resolved) |
| IMPROVEMENT-PLAN.md | Code quality V1, 8 sessions (all complete) |
| BACKLOG-F28-RESP.md | F28 Responsive Desktop items (all complete) |
| BACKLOG-2026-03-01-round6-9.md | Historical backlog rounds 1-9 |
| CHANGELOG-2025-2026-02.md | Changelog entries before 2026-03 |

## How Files Relate

```
VISION.md (Why?)
  |
PRODUCT.md (What?)
  |
FEATURES-CORE.md + FEATURES-CAPTURE.md + FEATURES-FLYER.md (How -- implemented)
FEATURES-INVENTORY.md + SCAN-AND-GO.md + FEATURES-ELSEWHERE.md  (How -- implemented)
  |
FEATURES-PLANNED.md + FEATURES-PHASE2-SPECS.md (How -- planned, prioritized)
FEATURES-INSIGHTS.md + FEATURES-NOTIFICATIONS.md               (How -- planned, detailed)
  |
BACKLOG.md (Tech debt) + IMPROVEMENT-PLAN-V2.md (Refactoring sessions)
  |
DATA-MODEL.md + DATA-MODEL-EXTENDED.md (Database schema)
LEARNING-ALGORITHMS.md (Sorting logic)
SEARCH-ARCHITECTURE.md + SEARCH-SCORING.md (Search pipeline)
ARCHITECTURE.md (Tech stack, API, deployment)
  |
UI.md (Presentation)
```

## For Cursor / Claude Code Prompts

Always reference the specific file:
- Shopping list bug → "Read FEATURES-CORE.md section F03"
- Photo upload issue → "Read FEATURES-CAPTURE.md"
- Flyer display → "Read FEATURES-FLYER.md"
- Database question (core tables) → "Read DATA-MODEL.md"
- Database question (photos, receipts, competitors) → "Read DATA-MODEL-EXTENDED.md"
- Search pipeline → "Read SEARCH-ARCHITECTURE.md"
- Search scoring / weights → "Read SEARCH-SCORING.md"
- Sorting logic → "Read LEARNING-ALGORITHMS.md"
- Account / Auth → "Read FEATURES-ACCOUNT.md"
- Feature prioritization / what to build next → "Read FEATURES-PLANNED.md"
- Phase 2 feature specs (F31-F41) → "Read FEATURES-PHASE2-SPECS.md"
- Scan & Go / in-store scanning → "Read SCAN-AND-GO.md"
- Planned features (voice, recipe, semantic search) → "Read FEATURES-PLANNED.md"
