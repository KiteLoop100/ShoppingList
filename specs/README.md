# Project Documentation -- Digital Shopping List

## Files and Responsibilities

| File | Content | ~Lines |
|------|---------|--------|
| **VISION.md** | Why does this product exist? Benefits for customers and ALDI. Strategic compass. | 100 |
| **PRODUCT.md** | Product concept, target audience, design principles | 100 |
| **MVP.md** | What's in the MVP, what's not | 145 |
| **FEATURES-CORE.md** | F01-F12, F23, F29: Search, shopping list, sorting, store detection, settings, catalog, comments | 530 |
| **FEATURES-PLANNED.md** | Prioritized feature backlog (27 features ranked by Nutzen x Einfachheit). Detailed specs for F02-SS, F15, F20, F22, F27. Lightweight specs for F31-F41 (Vergessen-Detektor, Budget-Tracker, Dark Mode, Templates, etc.) | 350 |
| **FEATURES-CAPTURE.md** | F13: Photo upload, receipt scan, PDF import, review workflow, manual creation | 217 |
| **FEATURES-FLYER.md** | F14: Flyer browser, add specials to list | 163 |
| **FEATURES-ELSEWHERE.md** | F26: Buy Elsewhere, competitor products, multi-retailer | 213 |
| **FEATURES-ACCOUNT.md** | F17: Accounts, Auth, Multi-Device, IndexedDB-to-Supabase migration | 327 |
| **FEATURES-FEEDBACK.md** | F25: Product, general, and post-shopping feedback | 330 |
| **FEATURES-NOTIFICATIONS.md** | Notification feature spec (planned) | 524 |
| **FEATURES-INSIGHTS.md** | F24: ALDI Insights analytics (planned) | 368 |
| **FEATURES-ALDI-KUNDEN-UNTERSTUETZUNG.md** | F30: Crowdsourced customer intelligence (planned) | 404 |
| **DATA-MODEL.md** | Core database tables: user, list, product, demand groups, store, trip | 338 |
| **DATA-MODEL-EXTENDED.md** | Extended tables: preferences, competitors, aisle order, photos, receipts, flyers, feedback | 330 |
| **LEARNING-ALGORITHMS.md** | Three-level sorting algorithm, pairwise comparisons | 305 |
| **SEARCH-ARCHITECTURE.md** | Search pipeline overview: preprocessing, candidate retrieval, match types | 313 |
| **SEARCH-SCORING.md** | Search scoring engine: signals, weights, post-processing, configuration | 442 |
| **ARCHITECTURE.md** | Tech stack, project structure, API design, deployment | 420 |
| **UI.md** | Screen designs, interaction patterns, design language | 537 |
| **OFFLINE-STRATEGY.md** | Offline mode specification (deferred) | 90 |
| **LAUNCH-READINESS.md** | Checkliste fuer Friendly User Test | 139 |
| **SECURITY-BACKLOG.md** | Open security items (Storage, RLS, Auth, API) | 117 |
| **ALDI-DATA-REQUEST.md** | Data request for ALDI: 40 fields in 3 priority tiers | 98 |
| **CHANGELOG.md** | Spec change history | 462 |

## How Files Relate

```
VISION.md (Why?)
  |
PRODUCT.md (What?)
  |
FEATURES-CORE.md + FEATURES-CAPTURE.md + FEATURES-FLYER.md (How -- implemented)
FEATURES-PLANNED.md + FEATURES-INSIGHTS.md + FEATURES-NOTIFICATIONS.md (How -- planned)
  |
DATA-MODEL.md + DATA-MODEL-EXTENDED.md (Database schema)
LEARNING-ALGORITHMS.md (Sorting logic)
SEARCH-ARCHITECTURE.md + SEARCH-SCORING.md (Search pipeline)
ARCHITECTURE.md (Tech stack, API, deployment)
  |
UI.md (Presentation)
```

## For Cursor Prompts

Always reference the specific file:
- Shopping list bug -> "Read FEATURES-CORE.md section F03"
- Photo upload issue -> "Read FEATURES-CAPTURE.md"
- Flyer display -> "Read FEATURES-FLYER.md"
- Database question (core tables) -> "Read DATA-MODEL.md"
- Database question (photos, receipts, competitors) -> "Read DATA-MODEL-EXTENDED.md"
- Search pipeline -> "Read SEARCH-ARCHITECTURE.md"
- Search scoring / weights -> "Read SEARCH-SCORING.md"
- Sorting logic -> "Read LEARNING-ALGORITHMS.md"
- Account / Auth -> "Read FEATURES-ACCOUNT.md"
- Feature prioritization / what to build next -> "Read FEATURES-PLANNED.md Priority Backlog"
- Planned features (voice, recipe, semantic search) -> "Read FEATURES-PLANNED.md"
- Launch preparation -> "Read LAUNCH-READINESS.md"
