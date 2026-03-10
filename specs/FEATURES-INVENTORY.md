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
| created_at | TIMESTAMPTZ | row creation |
| updated_at | TIMESTAMPTZ | last modification |

### Constraints

- Partial unique on `(user_id, product_id) WHERE product_id IS NOT NULL AND status != 'consumed'`
- Partial unique on `(user_id, competitor_product_id) WHERE competitor_product_id IS NOT NULL AND status != 'consumed'`
- RLS policy: `auth.uid()::text = user_id`

## Receipt Integration

- In `processValidReceipt()` (parse-receipt.ts): after `receipt_items` INSERT, call `upsertInventoryFromReceipt()`
- In `mergeIntoExistingReceipt()` (merge-receipt.ts): same call after merge INSERT
- The upsert checks `enable_inventory` server-side before writing
- Uses `ON CONFLICT` with named constraint to aggregate quantity

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
| Database migration | Done | `supabase/migrations/20260311200000_inventory_items.sql` |
| Service layer | Done | `src/lib/inventory/inventory-service.ts`, `inventory-types.ts`, `inventory-receipt.ts` |
| Unit tests | Done | `src/lib/inventory/__tests__/inventory-service.test.ts` |
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

---

*See also: [FEATURES-PLANNED.md](FEATURES-PLANNED.md), [FEATURES-CORE.md](FEATURES-CORE.md)*
