# FEATURES-INVENTORY.md — Household Inventory (Haushaltsinventar)

> **Status:** Complete
> **Feature-ID:** F42
> **Phase:** Phase 2
> **Default:** Deaktiviert (opt-in via Settings Toggle)

## Overview

The Household Inventory is a "digital twin" of products at home, powered by receipt inflows and "consumed" outflows. It lives as a second tab in the Receipts section (renamed "Mein Haushalt" when active).

## Data Flow

```
Receipts (auto) ──┐
Manual add ────────┤──► Inventory ──► Consumed ──► (optional) back to List
Barcode scan ──────┘     (sealed/opened)
```

## Feature Toggle

- New field `enable_inventory: boolean` in `UserSettings` (default `false`)
- Stored in `user_settings` table as `enable_inventory BOOLEAN NOT NULL DEFAULT false`
- All UI changes are conditional on this toggle
- Helper: `isInventoryEnabled()` in `settings-sync.ts`

## Database Schema

### Table: `inventory_items`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | auto-generated |
| user_id | TEXT NOT NULL | RLS-filtered |
| product_id | UUID FK nullable | ALDI product reference |
| competitor_product_id | UUID FK nullable | competitor product reference |
| display_name | TEXT NOT NULL | denormalized for fast display |
| demand_group_code | TEXT nullable | for category grouping |
| thumbnail_url | TEXT nullable | denormalized product image |
| quantity | INTEGER NOT NULL DEFAULT 1 | current stock count |
| status | TEXT NOT NULL DEFAULT 'sealed' | sealed / opened / consumed |
| source | TEXT NOT NULL DEFAULT 'receipt' | receipt / manual / barcode / photo |
| source_receipt_id | UUID FK nullable | originating receipt |
| added_at | TIMESTAMPTZ | when first added |
| opened_at | TIMESTAMPTZ nullable | when marked opened |
| consumed_at | TIMESTAMPTZ nullable | when marked consumed |
| best_before | DATE nullable | Mindesthaltbarkeitsdatum (MHD) |
| purchase_date | DATE nullable | explicit purchase date (from receipt or manual) |
| is_frozen | BOOLEAN NOT NULL DEFAULT false | whether item is in freezer |
| frozen_at | TIMESTAMPTZ nullable | when frozen |
| thawed_at | TIMESTAMPTZ nullable | when thawed |
| created_at | TIMESTAMPTZ | row creation |
| updated_at | TIMESTAMPTZ | last modification |

### Constraints

- Partial unique on `(user_id, product_id) WHERE product_id IS NOT NULL AND status != 'consumed'` — Note: with shelf life split-rows, multiple active rows for the same product_id can exist (different `best_before` dates). The upsert logic in `inventory-service.ts` handles this at the application level, not via DB constraint.
- Partial unique on `(user_id, competitor_product_id) WHERE competitor_product_id IS NOT NULL AND status != 'consumed'` — same note as above.
- RLS policy: `auth.uid()::text = user_id`

## Shelf Life & Auto-Calculated Best-Before

### Product-Level Shelf Life

Both `products` and `competitor_products` have an optional `typical_shelf_life_days` column (SMALLINT, nullable). This stores the typical number of days from purchase to best-before date for a product. Displayed in the product detail modal under "Typische Haltbarkeit" / "Typical shelf life" when set.

**Seeded values (migration `20260313110000`):**

| Product type | Shelf life | Count |
|---|---|---|
| Fresh milk (ESL/Frische Vollmilch) | 21 days | 10 |
| H-Milch / UHT (haltbare Vollmilch) | 180 days | 2 |
| Fresh yogurt (demand_group 51) | 21 days | 107 |
| Trinkjoghurt / Ayran (demand_group 83) | 28 days | 6 |

Non-dairy products containing "Vollmilch" or "Joghurt" in the name (chocolates, cookies, dressings, etc.) are intentionally excluded.

### Auto-Calculation from Receipt

When a receipt is processed and inventory is enabled, `upsertInventoryFromReceipt()` computes:

```
best_before = purchase_date + typical_shelf_life_days
```

This only happens when both `purchase_date` (from the receipt) and `typical_shelf_life_days` (from the product) are available. If either is null, `best_before` stays null.

The calculation uses `calculateBestBefore()` in `src/lib/inventory/shelf-life-calc.ts` — a pure function with UTC arithmetic to avoid timezone-related off-by-one errors.

### Split Rows for Different Best-Before Dates

When the same product is bought on different dates (producing different `best_before` values), `upsertInventoryItem()` creates **separate inventory rows** instead of merging quantity. This ensures each expiry date is individually trackable and editable.

**Merge logic:**
- Input has same `best_before` as existing row → merge (increment quantity)
- Input has different `best_before` → insert new row
- Input has no `best_before` (null) → merge into first existing row

In the inventory list, split items appear as separate rows with the same name but distinct MHD badges.

### FEFO (First Expiry, First Out)

`findInventoryItemByProductId()` (used by barcode consume/open flows) returns the item expiring soonest: `ORDER BY best_before ASC NULLS LAST LIMIT 1`.

### Manual Override

Users can always override `best_before` via long-press → "MHD bearbeiten". Once manually set, it is never overwritten by auto-calculation.

### Perishable Filter

`filterExpiredPerishables()` uses two strategies:
- **When `best_before` is set:** Filters items whose `best_before` is more than 3 days in the past (grace period).
- **When `best_before` is null:** Falls back to category-based shelf life using `updated_at` (produce: 10 days, chilled: 14 days).
- Frozen items are never filtered.

## Receipt Integration

- In `processValidReceipt()` (parse-receipt.ts): after `receipt_items` INSERT, call `upsertInventoryFromReceipt()`
- In `mergeIntoExistingReceipt()` (merge-receipt.ts): same call after merge INSERT
- The upsert checks `enable_inventory` server-side before writing
- `batchLookupProductMeta()` fetches `typical_shelf_life_days` alongside `demand_group_code` and `thumbnail_url`
- `best_before` is auto-calculated when shelf life data is available

## UI Components

### Tab Switcher (receipts-client.tsx)
- Only shown when `enable_inventory === true`
- Tabs: "Kassenzettel" (existing) | "Vorrat" (new)
- Page title changes: "Einkäufe" → "Mein Haushalt"

### Inventory List (inventory-list.tsx)
- Grouped by demand_group_code (meta-categories)
- Filter chips: All | Opened | Category-based
- Each row shows: thumbnail, name, quantity, status badge

### Interactions
- Swipe left → "Aufgebraucht" (consumed)
- Swipe right → "Geöffnet" (opened)
- Tap quantity → picker (1-99)
- Long-press → context menu

### Consumed Flow (3 paths)
1. **Inventory tab**: swipe left on item
2. **Magic keyword**: type "aufgebraucht" in search field
3. **PurchaseHistoryMenu**: "Aufgebraucht melden" entry

## Implementation Status

| Component | Status | Files |
|-----------|--------|-------|
| Database migration | Done | `supabase/migrations/20260311200000_inventory_items.sql`, `20260312200000_inventory_mhd_frozen.sql`, `20260313100000_product_shelf_life.sql`, `20260313110000_seed_shelf_life_milk_yogurt.sql` |
| Service layer | Done | `src/lib/inventory/inventory-service.ts`, `inventory-types.ts`, `inventory-receipt.ts`, `inventory-freeze.ts`, `shelf-life-calc.ts` |
| MHD + Freezer logic | Done | `src/lib/inventory/expiry-color.ts`, `thaw-shelf-life.ts` |
| Shelf life auto-calc | Done | `src/lib/inventory/shelf-life-calc.ts`, `inventory-receipt.ts` (best_before computed from purchase_date + typical_shelf_life_days) |
| Unit tests | Done | `src/lib/inventory/__tests__/inventory-service.test.ts`, `expiry-color.test.ts`, `thaw-shelf-life.test.ts`, `shelf-life-calc.test.ts`, `perishable-filter.test.ts` |
| Feature toggle | Done | `src/lib/settings/settings-sync.ts`, settings UI |
| Receipt integration | Done | `src/lib/receipts/parse-receipt.ts`, `merge-receipt.ts` |
| Tab switcher + inventory list | Done | `src/app/[locale]/receipts/receipts-client.tsx`, `src/components/inventory/` |
| Consumed flow (3 paths) | Done | `src/lib/search/commands.ts`, `consumed-panel.tsx`, `purchase-history-menu.tsx` |
| Barcode scanner (inventory context) | Done | `src/components/search/barcode-scanner-modal.tsx` (`onProductConsumed` prop) |
| Translations (DE + EN) | Done | `src/messages/de.json`, `en.json` |
| Navigation updates | Done | `src/components/layout/app-shell.tsx`, `src/app/[locale]/page.tsx` |
| Type exports | Done | `src/types/index.ts` |
| Manual add (product search + barcode button in inventory tab) | Done | `src/components/inventory/inventory-add-modal.tsx`, `inventory-list.tsx` |

## Robustness Notes

1. **CRITICAL**: Partial unique index requires `ON CONFLICT ON CONSTRAINT` syntax (named constraint)
2. **CRITICAL**: `saveSettings()` upsert must include `enable_inventory` field
3. Race conditions on concurrent receipts handled by PostgreSQL atomic upsert
4. Consumed items excluded from unique constraint (allows re-purchase)
5. Denormalized fields may become stale (acceptable for MVP)
6. **CRITICAL**: `upsertInventoryItem` uses `.limit(10)` instead of `.maybeSingle()` because multiple active rows can exist for the same product (split by `best_before`). Using `.maybeSingle()` would throw when >1 row exists.
7. `findInventoryItemByProductId` uses `ORDER BY best_before ASC NULLS LAST LIMIT 1` for FEFO ordering. Same `.maybeSingle()` avoidance rationale as #6.
8. `calculateBestBefore()` uses UTC arithmetic (`Date.UTC()`) to avoid timezone-related off-by-one errors when computing expiry dates.

---

*See also: [FEATURES-PLANNED.md](FEATURES-PLANNED.md), [FEATURES-CORE.md](FEATURES-CORE.md)*
