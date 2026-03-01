# Project Documentation – Digital Shopping List

## Files and Responsibilities

| File | Content | ~Lines |
|------|---------|--------|
| **VISION.md** | Why does this product exist? Benefits for customers and ALDI. Strategic compass. | 120 |
| **FEATURES-CORE.md** | F01-F12: Search, shopping list, sorting, store detection, settings | 180 |
| **FEATURES-CAPTURE.md** | F13: Photo upload, receipt scan, PDF import, review workflow, manual creation | 150 |
| **FEATURES-FLYER.md** | F14: Flyer browser, add specials to list | 100 |
| **DATA-MODEL.md** | All database tables and fields | 500 |
| **LEARNING-ALGORITHMS.md** | Three-level sorting algorithm, pairwise comparisons | 400 |
| **ARCHITECTURE.md** | Tech stack, project structure, deployment, data flow | 440 |
| **UI.md** | Screen designs, interaction patterns | 350 |
| **MVP.md** | What's in the MVP, what's not | 150 |
| **PRODUCT.md** | Product concept, market analysis | 200 |
| **OFFLINE-STRATEGY.md** | Offline mode specification (deferred to Phase 2) | 250 |
| **FEATURES-ACCOUNT.md** | F17: Accounts, Auth, Multi-Device, IndexedDB→Supabase Migration | 200 |
| **LAUNCH-READINESS.md** | Checkliste für Friendly User Test (100–1.000 Nutzer) | 200 |
| **ALDI-DATA-REQUEST.md** | Data request for ALDI: 40 fields in 3 priority tiers | 150 |
| **SECURITY-BACKLOG.md** | Offene Sicherheitsthemen (Storage, RLS, Auth, API-Schutz) | 150 |
| **CHANGELOG.md** | Spec change history | 100 |

## How Files Relate

```
VISION.md (Why?)
  ↓
PRODUCT.md (What?)
  ↓
FEATURES-CORE.md + FEATURES-CAPTURE.md + FEATURES-FLYER.md (How exactly?)
  ↓
DATA-MODEL.md + LEARNING-ALGORITHMS.md + ARCHITECTURE.md (Technical implementation)
  ↓
UI.md (Presentation)
```

## For Cursor Prompts

Always reference the specific file:
- Shopping list bug → "Read FEATURES-CORE.md section F03"
- Photo upload issue → "Read FEATURES-CAPTURE.md"
- Flyer display → "Read FEATURES-FLYER.md"
- Database question → "Read DATA-MODEL.md"
- Sorting logic → "Read LEARNING-ALGORITHMS.md"
- Account / Auth → "Read FEATURES-ACCOUNT.md"
- Launch preparation → "Read LAUNCH-READINESS.md"

## Deprecated

- **FEATURES.md** – Content has been split into FEATURES-CORE.md, FEATURES-CAPTURE.md and FEATURES-FLYER.md. Can be deleted.
