# FEATURES-NOTIFICATIONS.md – Smart Savings Notifications (F29)

> Personalized, location-aware notifications about price reductions and deals in the user's preferred store.
> ALDI's answer to the LIDL Plus coupon system — but smarter: based on real purchase history, not manual coupon clipping.
> For account/auth see FEATURES-ACCOUNT.md, for store detection see FEATURES-CORE.md (F04).

---

## 1. Overview

| Aspect | Value |
|--------|-------|
| **Feature ID** | F29 |
| **Phase** | Phase 3 (Notification Preferences + In-App Alerts), Phase 4 (Web Push + Geofencing) |
| **Dependencies** | F17 (Account & Auth), F04 (Store Detection / GPS), F07 (Shopping Analytics), Receipt scanning (F13) |
| **Route** | `/[locale]/settings` (Notification Preferences), In-App overlay (deal alerts) |
| **Navigation** | Settings → Benachrichtigungen; In-app banner/toast for alerts |

### Goal

Proactively notify users about money-saving opportunities in their preferred store — especially real-time price reductions (markdowns) on products that match their personal shopping habits. Notifications become more immediate and contextual when the user enters the store (geofencing).

### Win-Win Principle

This feature creates mutual value — the strategic core of the concept:

| Side | Benefit |
|------|---------|
| **Customer** | Saves money on products they actually buy. No coupon clipping, no browsing flyers — savings come to them automatically. |
| **ALDI** | Accelerates sell-through of marked-down products (especially perishables approaching best-before date). Reduces food waste. Increases basket size through relevant impulse buys. Strengthens customer loyalty without a points/rewards program. |

This is ALDI's equivalent of the LIDL Plus coupon — but without the friction of manual activation. The app knows what the customer buys and surfaces relevant deals automatically.

---

## 2. Notification Types

### 2.1 Personalized Deal Alerts

Notifications about products that are currently reduced and match the user's purchase profile.

**Trigger:** New markdowns are published for the user's preferred store.

**Logic:**
1. Compare markdown product list against user's purchase history (last 90 days from receipts + shopping trips)
2. Score each markdown by relevance: frequency of purchase × discount percentage
3. Top N products (configurable, default 3) are surfaced as a notification

**Example:**
```
💰 Spar-Tipp für ALDI Musterstraße
Himbeeren 250g: jetzt €1,49 statt €2,19 (–32%)
Du kaufst Himbeeren regelmäßig — heute sparst du €0,70

[Zur Liste hinzufügen]  [Später]
```

**Delivery channels:**
- In-app banner (always, when app is open)
- Web Push notification (if enabled by user, Phase 4)

### 2.2 In-Store Proximity Alerts

When the user enters their store (geofencing), a contextual notification highlights the best current deals relevant to them.

**Trigger:** GPS detects user entering store radius (100m, same as F04 store detection).

**Logic:**
1. On store entry, check for active markdowns at this store
2. Filter by user's purchase history and preferences
3. Compose a compact summary of the top deals

**Example (Web Push):**
```
📍 Willkommen bei ALDI Musterstraße!
3 reduzierte Artikel, die dich interessieren könnten:
• Himbeeren 250g – jetzt €1,49 (–32%), noch 25 Stk.
• Bio-Hackfleisch 400g – jetzt €2,99 (–25%)
• Milsani Skyr – jetzt €0,89 (–20%)

[Angebote ansehen]
```

**Example (In-App banner, if app is already open):**
```
┌─────────────────────────────────────┐
│ 📍 3 Spar-Tipps für deinen Einkauf │
│                                     │
│ 🔴 Himbeeren 250g        –32%      │
│    €1,49 statt €2,19 · 25 Stk.    │
│                             [+]     │
│ 🔴 Bio-Hackfleisch 400g  –25%      │
│    €2,99 statt €3,99               │
│                             [+]     │
│ 🔴 Milsani Skyr Natur    –20%      │
│    €0,89 statt €1,09               │
│                             [+]     │
│                                     │
│ [Alle ansehen]  [Schließen]        │
└─────────────────────────────────────┘
```

### 2.3 Flash Markdown Alerts

Real-time alerts for significant markdowns that just happened (e.g. perishables marked down in the afternoon).

**Trigger:** Store publishes a new markdown event (e.g. 16:00 afternoon markdown round for perishables).

**Logic:**
1. New markdown published → check against user's purchase profile
2. Only notify if: user has purchased this product or category ≥2 times in last 90 days AND discount ≥ 20%
3. Include stock level if available

**Example:**
```
⚡ Gerade reduziert bei ALDI Musterstraße
Himbeeren 250g: –30%, jetzt €1,53
Noch 25 Stück verfügbar

[Zur Liste hinzufügen]
```

**Frequency cap:** Max 2 flash alerts per day per user (to avoid notification fatigue).

### 2.4 Weekly Savings Digest (Future)

A weekly summary of potential savings based on the user's regular purchases and upcoming deals.

**Delivery:** Web Push or in-app (Sunday evening for Monday shopping).

**Example:**
```
📊 Dein Spar-Überblick für diese Woche
3 deiner regelmäßigen Produkte sind im Angebot:
Du könntest diese Woche €4,20 sparen.

[Angebote ansehen]
```

---

## 3. Data Requirements

### 3.1 Data Sources

| Source | Available Today | Required For | Notes |
|--------|----------------|--------------|-------|
| User purchase history | ✅ (receipts, trips) | Personalization scoring | Last 90 days, aggregated by product/category |
| Product database | ✅ (products table) | Product matching | Regular prices as baseline |
| Store assignment | ✅ (default store, GPS) | Store-specific deals | F04 store detection |
| **Markdown/reduction data** | ❌ Requires ALDI integration | All notification types | Real-time or near-real-time price reductions |
| **Stock levels** | ❌ Requires ALDI integration | "Noch X Stück" display | Optional but high-value signal |

### 3.2 New Data Model: Markdown Events

```sql
CREATE TABLE store_markdowns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(store_id),
  product_id UUID NOT NULL REFERENCES products(product_id),
  original_price NUMERIC(10,2) NOT NULL,
  markdown_price NUMERIC(10,2) NOT NULL,
  discount_percent INTEGER GENERATED ALWAYS AS (
    ROUND((1 - markdown_price / NULLIF(original_price, 0)) * 100)
  ) STORED,
  stock_remaining INTEGER,           -- NULL if unknown
  reason TEXT CHECK (reason IN ('best_before', 'overstock', 'seasonal_end', 'other')),
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,           -- NULL = until sold out
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_markdowns_store_active ON store_markdowns(store_id, is_active)
  WHERE is_active = true;
CREATE INDEX idx_markdowns_product ON store_markdowns(product_id);
```

### 3.3 New Data Model: Notification Preferences

```sql
CREATE TABLE notification_preferences (
  user_id TEXT PRIMARY KEY,
  notifications_enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Channel preferences
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT false,
  push_subscription JSONB,              -- Web Push subscription object
  
  -- Content preferences
  deal_alerts_enabled BOOLEAN NOT NULL DEFAULT true,
  proximity_alerts_enabled BOOLEAN NOT NULL DEFAULT true,
  flash_alerts_enabled BOOLEAN NOT NULL DEFAULT true,
  weekly_digest_enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Thresholds
  min_discount_percent INTEGER NOT NULL DEFAULT 20,  -- Only notify for discounts >= X%
  min_purchase_frequency INTEGER NOT NULL DEFAULT 2, -- Product bought >= X times in 90 days
  max_alerts_per_day INTEGER NOT NULL DEFAULT 5,
  
  -- Proximity
  proximity_radius_m INTEGER NOT NULL DEFAULT 100,
  
  -- Quiet hours
  quiet_hours_start TIME,              -- e.g. '22:00'
  quiet_hours_end TIME,                -- e.g. '07:00'
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.4 New Data Model: Notification Log

```sql
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  notification_type TEXT NOT NULL CHECK (
    notification_type IN ('deal_alert', 'proximity_alert', 'flash_alert', 'weekly_digest')
  ),
  store_id UUID REFERENCES stores(store_id),
  markdown_id UUID REFERENCES store_markdowns(id),
  product_id UUID REFERENCES products(product_id),
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'push')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_at TIMESTAMPTZ,              -- NULL = not opened
  action_taken TEXT,                   -- 'added_to_list', 'dismissed', NULL
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_date ON notification_log(user_id, delivered_at DESC);
```

---

## 4. Notification Preferences UI (Settings)

A new section in Settings, below "Produktpräferenzen":

```
┌─────────────────────────────────────┐
│ 🔔 Benachrichtigungen              │
│                                     │
│ Spar-Benachrichtigungen        [●] │
│ Erhalte Hinweise zu reduzierten     │
│ Produkten, die zu deinen Einkäufen  │
│ passen.                             │
│                                     │
│ ── Benachrichtigungsarten ───────── │
│                                     │
│ Persönliche Spar-Tipps         [●] │
│  Reduzierte Produkte, die du        │
│  regelmäßig kaufst                  │
│                                     │
│ Im-Laden-Hinweise              [●] │
│  Benachrichtigung beim Betreten     │
│  deines ALDI-Marktes               │
│                                     │
│ Blitz-Angebote                 [○] │
│  Sofort-Hinweise bei neuen          │
│  Reduzierungen (z.B. 16-Uhr-       │
│  Abverkauf)                         │
│                                     │
│ Wochen-Überblick               [○] │
│  Sonntags: Zusammenfassung der      │
│  Spar-Möglichkeiten für die Woche  │
│                                     │
│ ── Feinsteuerung ────────────────── │
│                                     │
│ Mindest-Rabatt                      │
│  [────●─────────] 20%              │
│  Nur Rabatte ab diesem Wert         │
│                                     │
│ Push-Benachrichtigungen        [○] │
│  Auch wenn die App geschlossen ist │
│  (Berechtigung erforderlich)        │
│                                     │
│ Ruhezeiten                          │
│  Von [22:00] bis [07:00]           │
│  Keine Benachrichtigungen in        │
│  diesem Zeitraum                    │
│                                     │
│ Max. Benachrichtigungen / Tag       │
│         ┌─────────┐                │
│    [-]  │    5    │  [+]           │
│         └─────────┘                │
└─────────────────────────────────────┘
```

**Behavior:**
- Master toggle ("Spar-Benachrichtigungen") enables/disables the entire feature
- Individual notification types can be toggled independently
- Push toggle triggers browser permission request (`Notification.requestPermission()`)
- All changes saved to Supabase immediately (same pattern as F12 settings)
- Quiet hours prevent all notifications during the specified window

---

## 5. Technical Architecture

### 5.1 Phase 3: In-App Notifications

```
[Store Markdown Data] ──(ALDI API / manual import)──→ store_markdowns table
                                                            │
[App Opens / Store Detected] ──→ GET /api/notifications/deals
                                       │
                                       ├── Load user's notification preferences
                                       ├── Load active markdowns for user's store
                                       ├── Score markdowns against purchase history
                                       ├── Filter by min_discount_percent + min_purchase_frequency
                                       ├── Rank by relevance score, take top N
                                       │
                                       └── Return personalized deal list → In-app banner/overlay
```

**API Endpoint:** `GET /api/notifications/deals`

**Request:**
```json
{
  "user_id": "auth.uid()",
  "store_id": "uuid-of-detected-store",
  "locale": "de"
}
```

**Response:**
```json
{
  "deals": [
    {
      "markdown_id": "uuid",
      "product_id": "uuid",
      "product_name": "Himbeeren 250g",
      "original_price": 2.19,
      "markdown_price": 1.49,
      "discount_percent": 32,
      "stock_remaining": 25,
      "reason": "best_before",
      "relevance_score": 87,
      "relevance_reason": "Du kaufst Himbeeren regelmäßig (6× in 90 Tagen)"
    }
  ],
  "total_potential_savings": 4.20
}
```

### 5.2 Relevance Scoring

Each markdown is scored against the user's profile:

```
relevance_score =
    purchase_frequency_score    (0–50)   // How often the user buys this product or category
  + discount_score              (0–30)   // Higher discount = higher score
  + recency_score               (0–20)   // Recently purchased products score higher

purchase_frequency_score:
  exact product match:  count_in_90_days × 10 (capped at 50)
  category match only:  count_in_90_days × 3  (capped at 25)

discount_score:
  discount_percent × 0.3 (e.g. 30% discount → 9 points)

recency_score:
  days_since_last_purchase < 7:  20
  days_since_last_purchase < 14: 15
  days_since_last_purchase < 30: 10
  days_since_last_purchase < 60: 5
  else: 0
```

**Minimum threshold:** Only show deals with `relevance_score >= 15` (configurable).

### 5.3 Phase 4: Web Push Notifications

```
[New Markdown Published] ──→ Supabase Edge Function (trigger on store_markdowns INSERT)
        │
        ├── Query: which users have this store as default + push_enabled?
        ├── For each user: score markdown against their profile
        ├── If relevance_score >= threshold:
        │     └── Send Web Push via web-push library
        │
        └── Log notification in notification_log
```

**Web Push setup:**
- Service Worker (`sw.js`) handles push events
- VAPID key pair generated and stored in environment variables
- `push_subscription` (from `PushManager.subscribe()`) stored in `notification_preferences`
- Push payload kept small (<4KB): title, body, icon, action URL

### 5.4 Phase 4: Geofencing

Geofencing for proximity alerts builds on existing GPS polling from F04:

```
[GPS poll every 90s (existing)] ──→ User enters store radius?
        │
        YES ──→ Check: proximity_alerts_enabled?
                  │
                  YES ──→ Check: last proximity alert for this store > 4 hours ago?
                            │
                            YES ──→ Fetch deals → Compose proximity notification → Push or in-app
                            NO  ──→ Skip (cooldown)
```

**Cooldown:** Max 1 proximity alert per store per 4-hour window (prevents re-triggering on GPS flicker or short re-entries).

---

## 6. Markdown Data: Integration Options

The feature's value depends on ALDI providing markdown data. Three integration tiers:

### Tier 1: Manual / CSV Import (MVP of the feature)
- ALDI store manager uploads daily markdowns via admin UI or CSV
- Minimal integration effort, proves the concept
- Limitation: not real-time, depends on manual input

### Tier 2: ALDI Internal API
- Direct integration with ALDI's inventory/POS system
- Near-real-time markdown data
- Stock levels available
- Requires ALDI IT partnership

### Tier 3: Smart Price Tags / IoT
- Electronic shelf labels (ESL) broadcast price changes
- Fully real-time, automated
- Stock levels via weight sensors or inventory system
- Long-term vision

**MVP approach:** Start with Tier 1 (manual/CSV) to validate the concept and user acceptance, then advocate for Tier 2 integration.

---

## 7. Privacy & User Control

| Principle | Implementation |
|-----------|---------------|
| **Opt-in only** | All notifications disabled by default. User must actively enable. |
| **Granular control** | Each notification type toggleable independently. |
| **Transparent data use** | Settings page explains: "Basierend auf deiner Einkaufshistorie" |
| **Quiet hours** | User-defined time window with no notifications. |
| **Daily cap** | Hard limit on notifications per day (user-configurable, default 5). |
| **Easy opt-out** | Master toggle disables everything in one tap. |
| **No dark patterns** | No "Are you sure?" when disabling. No repeated prompts to re-enable. |
| **Data stays local** | Purchase history scoring happens server-side but no profile is shared with third parties. |

---

## 8. Comparison: ALDI Smart Savings vs. LIDL Plus Coupons

| Aspect | LIDL Plus Coupons | ALDI Smart Savings (F29) |
|--------|-------------------|--------------------------|
| **Activation** | Manual: browse, select, activate each coupon | Automatic: deals matched to purchase history |
| **Personalization** | Generic coupons, same for everyone | Personalized: based on what you actually buy |
| **Timing** | Pre-planned, weekly cycles | Real-time: reacts to actual store markdowns |
| **Friction** | Must remember to activate before shopping | Zero friction: notifications come to you |
| **Stock awareness** | No | Yes: "Noch 25 Stück" reduces waste and uncertainty |
| **In-store trigger** | No | Yes: contextual alert on store entry |
| **Value for retailer** | Drives planned traffic | Drives impulse buys on already-reduced stock (higher margin recovery) |

---

## 9. Metrics & Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Opt-in rate | ≥30% of active users enable notifications | `notification_preferences` table |
| Notification-to-list rate | ≥15% of deal alerts result in "Add to list" | `notification_log.action_taken` |
| Markdown sell-through lift | Measurable increase in markdown product sales | ALDI POS data (requires ALDI partnership) |
| Unsubscribe rate | <5% per month | `notification_preferences` toggle-off events |
| Notification fatigue signal | <10% dismiss-without-reading rate | `notification_log.opened_at` NULL ratio |

---

## 10. Phased Rollout

### Phase 3: Foundation
- [ ] `notification_preferences` table + Settings UI
- [ ] `store_markdowns` table + Admin CSV import
- [ ] In-app deal banner (shown when app opens or store detected)
- [ ] Relevance scoring engine
- [ ] "Add to list" action from deal notification
- [ ] Notification log for analytics

### Phase 4: Push & Geofencing
- [ ] Web Push infrastructure (VAPID, Service Worker, subscription management)
- [ ] Push notifications for deal alerts + flash alerts
- [ ] Geofencing proximity alerts (builds on F04 GPS polling)
- [ ] Weekly digest push
- [ ] Quiet hours enforcement

### Phase 5: Intelligence
- [ ] ALDI API integration for real-time markdowns + stock levels
- [ ] AI-powered notification timing optimization (learn when user is most likely to act)
- [ ] Cross-store comparison ("Dieses Produkt ist bei ALDI Hauptstraße noch günstiger")
- [ ] Predictive alerts ("Himbeeren werden erfahrungsgemäß donnerstags reduziert")

---

## 11. Affected Files (Phase 3)

- `supabase/migrations/XXXXXX_store_markdowns.sql` – New table
- `supabase/migrations/XXXXXX_notification_preferences.sql` – New table + RLS
- `supabase/migrations/XXXXXX_notification_log.sql` – New table + RLS
- `src/app/api/notifications/deals/route.ts` – Deal fetching + relevance scoring
- `src/lib/notifications/relevance-scoring.ts` – Scoring algorithm
- `src/lib/notifications/notification-preferences.ts` – Read/write preferences
- `src/components/notifications/deal-banner.tsx` – In-app deal overlay
- `src/components/notifications/deal-card.tsx` – Individual deal display
- `src/app/[locale]/settings/settings-client.tsx` – Notification preferences section
- `src/messages/de.json` + `en.json` – Translation keys

---

*Last updated: 2026-03-03*
*See also: FEATURES-CORE.md (F04, F07, F12), FEATURES-ACCOUNT.md (F17), VISION.md*
