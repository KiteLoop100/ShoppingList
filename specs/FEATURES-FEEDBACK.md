# FEATURES-FEEDBACK.md – Customer Feedback (F25)

> Product-level and general feedback from customers to ALDI.
> All feedback stored in Supabase for later analysis/export.

---

## 1. Overview

| Aspect | Value |
|--------|-------|
| **Feature ID** | F25 |
| **Phase** | MVP |
| **Dependencies** | F17 (Account & Auth) |
| **Access Points** | Product Detail Modal, Settings page, post-shopping |

### Goal

Give users a simple, low-friction way to send feedback to ALDI — both about specific products and about the shopping experience in general. Feedback is stored in Supabase and can be exported or analyzed later. This creates a direct customer → ALDI communication channel, separate from the sorting error reporting (F06).

---

## 2. Feedback Types

| Type | Trigger | What's Captured |
|------|---------|-----------------|
| **Product feedback** | Button in Product Detail Modal | Product reference, category, free text, optional rating |
| **General feedback** | Button in Settings page | Free text, optional category tag |
| **Post-shopping feedback** | Optional prompt after "Shopping complete" | Trip reference, satisfaction rating, free text |

---

## 3. Data Model

### Table: `feedback`

| Field | Type | Description |
|-------|------|-------------|
| feedback_id | UUID PK | Unique ID |
| user_id | TEXT NOT NULL | `auth.uid()` |
| feedback_type | TEXT NOT NULL | `product` / `general` / `post_shopping` |
| product_id | UUID | Reference to `products.product_id` (only for product feedback) |
| trip_id | UUID | Reference to `shopping_trips.trip_id` (only for post-shopping) |
| store_id | UUID | Store context (from current/last trip, optional) |
| category | TEXT | User-selected category tag (see below) |
| rating | INTEGER | 1–5 star rating (optional) |
| message | TEXT NOT NULL | Free-text feedback (max 2,000 characters) |
| status | TEXT DEFAULT 'new' | `new` / `read` / `archived` |
| created_at | TIMESTAMPTZ | Submission timestamp |

**RLS Policy:** Users can INSERT their own feedback (`user_id = auth.uid()::text`). SELECT/UPDATE/DELETE restricted to admin.

### Feedback Categories

| feedback_type | Available Categories |
|---------------|---------------------|
| **product** | `quality` (Qualität), `price` (Preis), `availability` (Verfügbarkeit), `packaging` (Verpackung), `suggestion` (Vorschlag), `other` (Sonstiges) |
| **general** | `store` (Filiale), `app` (App), `assortment` (Sortiment), `suggestion` (Vorschlag), `praise` (Lob), `other` (Sonstiges) |
| **post_shopping** | `experience` (Einkaufserlebnis), `waiting_time` (Wartezeit), `cleanliness` (Sauberkeit), `staff` (Personal), `other` (Sonstiges) |

---

## 4. UI: Product Feedback

### Access: Product Detail Modal

A new "Feedback" button at the bottom of the Product Detail Modal, below the comment section (F23) and "Produkt bearbeiten":

```
┌─────────────────────────────────────┐
│ Produktdetails                    ✕ │
│                                     │
│ ... (product info, nutrition, etc.) │
│                                     │
│ 🔄 Automatischer Nachkauf    [off] │
│ 💬 Kommentar (F23)                  │
│                                     │
│ [ Produkt bearbeiten ]              │
│                                     │
│─────────────────────────────────────│
│ 📣 Feedback zu diesem Produkt       │
│                                     │
│ Wie findest du dieses Produkt?      │
│                                     │
│  ☆ ☆ ☆ ☆ ☆  (optional)            │
│                                     │
│ Kategorie:                          │
│ [Qualität] [Preis] [Verfügbarkeit] │
│ [Verpackung] [Vorschlag] [Sonstiges]│
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Dein Feedback an ALDI…         │ │
│ │                                 │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                 0 / 2000            │
│                                     │
│      [ Feedback senden ]            │
│                                     │
│ Dein Feedback wird gespeichert und  │
│ kann vom ALDI-Team eingesehen       │
│ werden. Keine persönlichen Daten    │
│ werden weitergegeben.               │
└─────────────────────────────────────┘
```

**Behavior:**
- Star rating: optional, 1–5 stars (tap to set, tap same star to deselect)
- Category: single-select chips, one required
- Text: required, min 10 characters, max 2,000 characters
- "Feedback senden" → saves to Supabase → success toast: "Danke für dein Feedback! ✓"
- The feedback section is **collapsed by default** (just the button visible). Tap expands the form.
- Product context (product_id, name, category) is automatically attached

---

## 5. UI: General Feedback

### Access: Settings Page

New section in Settings, below the existing sections:

```
┌─────────────────────────────────────┐
│ ⚙️ Einstellungen                    │
│                                     │
│ ... (existing settings sections)    │
│                                     │
│─────────────────────────────────────│
│ 📣 Feedback                         │
│                                     │
│ Wir freuen uns über dein Feedback!  │
│                                     │
│ [ Allgemeines Feedback senden ]     │
│                                     │
└─────────────────────────────────────┘
```

Tapping opens a **fullscreen modal** or dedicated page:

```
┌─────────────────────────────────────┐
│ ← Feedback                          │
│                                     │
│ Was möchtest du uns mitteilen?      │
│                                     │
│ Kategorie:                          │
│ [Filiale] [App] [Sortiment]         │
│ [Vorschlag] [Lob] [Sonstiges]      │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Dein Feedback…                 │ │
│ │                                 │ │
│ │                                 │ │
│ │                                 │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                 0 / 2000            │
│                                     │
│      [ Feedback senden ]            │
│                                     │
└─────────────────────────────────────┘
```

**Behavior:**
- Category: single-select, required
- Text: required, min 10 characters, max 2,000 characters
- No star rating (general feedback doesn't rate a specific thing)
- Store context automatically attached if a default store is set
- Success: toast + return to Settings

---

## 6. UI: Post-Shopping Feedback (Optional Prompt)

After the "Shopping complete" animation (when the last product is checked off), a **non-intrusive** feedback prompt appears:

```
┌─────────────────────────────────────┐
│ ✅ Einkauf abgeschlossen!           │
│                                     │
│ Wie war dein Einkauf heute?         │
│                                     │
│  😞  😐  🙂  😊  🤩               │
│                                     │
│ [ Feedback schreiben ]  [ Fertig ]  │
└─────────────────────────────────────┘
```

**Behavior:**
- The 5 emoji faces map to ratings 1–5
- Tapping a face saves a minimal feedback record (rating only, no text)
- "Feedback schreiben" opens the full feedback form pre-filled with `feedback_type: post_shopping` and the trip reference
- "Fertig" dismisses without saving (no feedback)
- This prompt appears **at most once per trip** and only if the trip had 3+ checked items
- The prompt is **skippable** — no dark patterns, no guilt-tripping

---

## 7. Admin: Feedback Viewer

A new section in the admin area (`/admin`) to view and manage feedback:

```
┌─────────────────────────────────────┐
│ 📣 Feedback (47 neu)                │
│                                     │
│ Filter: [Alle] [Produkt] [Allgemein]│
│         [Nach Einkauf]              │
│                                     │
│ Sort: [Neueste zuerst ▾]            │
│                                     │
│─────────────────────────────────────│
│ ⭐⭐⭐⭐ · Produkt · Qualität        │
│ Milsani H-Milch 1,5%                │
│ "Seit neuestem schmeckt die Milch   │
│  anders. Rezeptur geändert?"        │
│ vor 2 Stunden                       │
│                                     │
│─────────────────────────────────────│
│ ⭐⭐⭐⭐⭐ · Allgemein · Lob          │
│ "Tolle App! Die Sortierung spart    │
│  mir so viel Zeit."                 │
│ vor 5 Stunden                       │
│                                     │
│─────────────────────────────────────│
│ 😊 · Nach Einkauf · Wartezeit       │
│ ALDI SÜD Musterstraße               │
│ "Nur eine Kasse offen bei 10        │
│  Leuten in der Schlange."           │
│ gestern                             │
│                                     │
│─────────────────────────────────────│
│                                     │
│ [ CSV Export ]                       │
└─────────────────────────────────────┘
```

**Admin features:**
- Filter by type, category, rating, date range
- Mark as read / archive
- CSV export for reporting
- No reply functionality (one-way feedback channel)

---

## 8. Rate Limiting & Anti-Spam

| Measure | Value |
|---------|-------|
| **Feedback per user per day** | Max 10 (across all types) |
| **Min text length** | 10 characters |
| **Max text length** | 2,000 characters |
| **Duplicate detection** | Same user + same product + same message within 24h → blocked |
| **Post-shopping prompt** | Max 1 per trip, only for trips with 3+ items |

Rate limiting uses the existing Upstash infrastructure (separate limit key: `feedback:{user_id}`).

---

## 9. Affected Files

### New Files

| File | Purpose |
|------|---------|
| `src/app/[locale]/feedback/page.tsx` | General feedback page (or modal) |
| `src/components/feedback/product-feedback-form.tsx` | Product feedback form (embedded in Product Detail Modal) |
| `src/components/feedback/general-feedback-form.tsx` | General feedback form |
| `src/components/feedback/post-shopping-prompt.tsx` | Post-shopping feedback prompt |
| `src/components/feedback/feedback-shared.tsx` | Shared components (category chips, star rating, text area) |
| `src/app/api/feedback/route.ts` | POST endpoint to save feedback |
| `src/app/[locale]/admin/feedback/page.tsx` | Admin feedback viewer |
| `src/lib/feedback/feedback-types.ts` | TypeScript interfaces |
| `supabase/migrations/YYYYMMDD_feedback.sql` | Feedback table + RLS policies |

### Modified Files

| File | Change |
|------|--------|
| `src/components/list/product-detail-modal.tsx` | Add collapsible product feedback section |
| `src/app/[locale]/settings/settings-client.tsx` | Add "Feedback" section |
| `src/components/list/shopping-list-content.tsx` | Post-shopping feedback trigger |
| `src/app/[locale]/admin/admin-client.tsx` | Add "Feedback" tab/section |
| `src/messages/de.json` + `en.json` | Feedback translation keys |
| `src/lib/api/rate-limit.ts` | Add feedback rate limit |

---

## 10. Data Model Update (DATA-MODEL.md)

Add to DATA-MODEL.md as section 20:

```
## 20. Feedback

| Field | Description |
|-------|-------------|
| feedback_id | Unique ID |
| user_id | Submitting user (auth.uid()) |
| feedback_type | product / general / post_shopping |
| product_id | Product reference (product feedback only) |
| trip_id | Trip reference (post-shopping only) |
| store_id | Store context (optional) |
| category | Category tag (quality, price, app, etc.) |
| rating | 1–5 stars or emoji rating (optional) |
| message | Free-text feedback (max 2,000 chars) |
| status | new / read / archived |
| created_at | Submission timestamp |
```

---

## 11. Future Extensions

- **Reply functionality:** Admin can respond to feedback (two-way channel)
- **Feedback analytics:** Dashboard showing trends, common complaints, sentiment analysis
- **Photo attachment:** Users can attach photos to feedback (e.g. damaged packaging)
- **Auto-categorization:** Claude categorizes free-text feedback automatically
- **Feedback forwarding:** Route product feedback to relevant ALDI department automatically
- **Feedback on specials:** "Was this special worth it?" prompt after purchasing a special item

---

*Created: 2026-02-27*
*Status: Implemented — MVP*
