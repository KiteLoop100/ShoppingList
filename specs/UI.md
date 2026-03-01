# UI.md – User Interface Specification

> Describes screens, navigation and interaction patterns.
> For feature details see FEATURES-CORE.md, for design language see section 5.

---

## 1. Core Principles

- **Mobile-first, one-hand operation:** All key elements reachable with thumb
- **Minimal clicks:** Most frequent actions in max 2 taps
- **No visual clutter:** Only essentials on screen. White space is a feature
- **No dark mode:** Single color scheme based on ALDI SÜD design language
- **No in-store/at-home distinction in MVP:** App always looks the same

---

## 2. Screens & Navigation

### 2.1 Screen Overview

The app has deliberately few screens. One **single main screen** combines: search, list, home. The user practically never leaves this screen.

```
┌──────────────────┐
│  Main Screen     │ ← Search + list in one
│  (S1)            │
│                  ├───→ ┌──────────────┐
│                  │     │ Store Select │
│                  │     │ (S2, Overlay)│
│                  │     └──────────────┘
│                  │
│                  ├───→ ┌──────────────┐
│                  │     │ Settings     │
│                  │     │ (S3)         │
│                  │     └──────────────┘
│                  │
│                  ├───→ ┌──────────────┐
│                  │     │ Flyer (F14)  │
│                  │     └──────────────┘
└──────────────────┘
                         Hidden:
                         ┌──────────────┐
                         │ Admin (S4)   │
                         └──────────────┘
```

### 2.2 Navigation Model

- **No tab bar.** The app is simple enough that tab navigation would add unnecessary complexity
- **No page switching between home and list.** Everything on one screen
- Navigation via contextual elements:
  - Main screen → Store selection: Tap on store name at top
  - Settings: Gear icon top right
  - Receipts: Receipt icon in navigation (+ button opens receipt scanner directly)
  - Flyer: Flyer icon in navigation
  - Admin: Link on settings page or /admin URL (includes Create Product)

---

## 3. Screen Descriptions

### S1: Main Screen

The user spends 100% of their time here. Search field on top, shopping list below. When typing in search field, results overlay the list completely.

**List Mode (Default – search field empty):**

```
┌─────────────────────────────────┐
│ [ALDI Logo]  Musterstr. ▾  [⚙️]│  ← Logo, store (tappable), settings
│ ┌──────────────────────────┐[⇅]│  ← Search + sort icon button
│ │ 🔍 Search... [Recent][📷]│   │     Sort button toggles mode
│ └──────────────────────────┘   │     and shows brief toast
│                                 │
│                                  │
│ ── Fruits & Vegetables ─────── │  ← Category header (only in
│                                  │     "Shopping Order" mode)
│ ┃○ Apples             [-] 1 [+]│  ← Border + label in category
│ ┃  Obst & Gemüse               │    color (Shopping Order only)
│ ┃○ Bananas            [-] 2 [+]│
│ ┃  Obst & Gemüse               │
│                                  │
│ ── Dairy ───────────────────── │
│                                  │
│ ┃○ Milsani Low-Fat    [-] 1 [+]│
│ ┃  Milchprodukte                │
│ ┃○ Gouda              [-] 1 [+]│
│ ┃  Milchprodukte                │
│                                  │
│ ── Checked Off ─────────────── │  ← Greyed out, at bottom
│                                  │
│ ✓ Butter             [-] 1 [+] │
│                                  │
│─────────────────────────────────│
│ Estimated price: ~€23.40       │  ← Fixed at bottom
│ (2 products without price)     │
│                                  │
│              [ ⚠ Error ]        │  ← Error button, subtle
└─────────────────────────────────┘

When list is empty:

┌─────────────────────────────────┐
│ [ALDI Logo]  Musterstr. ▾  [⚙️]│
│ ┌─────────────────────────────┐ │
│ │ 🔍 Search products...      │ │
│ └─────────────────────────────┘ │
│                                  │
│    Your list is empty.          │
│                                  │
│    [ Fill with typical items ]  │
│                                  │
└─────────────────────────────────┘
```

**Search Mode (search field active, user typing):**

Search results **completely overlay** the shopping list. List not visible until search is exited.

```
┌─────────────────────────────────┐
│ [ALDI Logo]  Musterstr. ▾      │
│ ┌─────────────────────────────┐ │
│ │ 🔍 Milk|               [✕] │ │  ← User typing, X to clear
│ └─────────────────────────────┘ │
│                                  │
│ ┌─────────────────────────────┐ │  ← Search results overlay
│ │                              │ │
│ │ ★ Milsani Low-Fat Milk     │ │  ← Personal favorite
│ │   1.5% 1L           €0.99  │ │
│ │                              │ │
│ │ Milsani Whole Milk          │ │  ← Popular
│ │   3.5% 1L           €1.09  │ │
│ │                              │ │
│ │ Milka Alpine Milk Chocolate │ │  ← Further matches
│ │   100g               €1.19  │ │
│ │                              │ │
│ └─────────────────────────────┘ │
│         ┌──────────────┐        │
│         │   [Return]   │        │  ← Return = add "Milk" generic
│         └──────────────┘        │
│ ┌─────────────────────────────┐ │
│ │  Keyboard                   │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Smart Default Mode (search field focused, no input yet):**

When the user taps the search field but hasn't typed anything, the app shows their most frequently purchased products (if sufficient purchase history exists).
```
┌─────────────────────────────────┐
│ [ALDI Logo]  Musterstr. ▾      │
│ ┌─────────────────────────────┐ │
│ │ 🔍 |                   [✕] │ │  ← Cursor in field, no text
│ └─────────────────────────────┘ │
│                                  │
│ ┌─────────────────────────────┐ │  ← Smart Default overlay
│ │                              │ │
│ │ Deine häufigsten Produkte:  │ │  ← Header
│ │                              │ │
│ │ Milsani Low-Fat Milk        │ │  ← Based on purchase_count
│ │   1.5% 1L           €0.99  │ │    + recency
│ │                              │ │
│ │ Bio Bananen                  │ │
│ │   1kg               €1.99  │ │
│ │                              │ │
│ │ Vollkornbrot                 │ │
│ │   500g              €1.29  │ │
│ │                              │ │
│ └─────────────────────────────┘ │
│                                  │
│ ┌─────────────────────────────┐ │
│ │  Keyboard                   │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

- Shown only when `user_product_preferences` has ≥ 3 entries
- Max 10 products
- Ranking: see [SEARCH-ARCHITECTURE.md](../specs/SEARCH-ARCHITECTURE.md) §3.1
- Disappears as soon as user starts typing (switches to Search Mode)
- If insufficient history: shows empty field with "Recent Purchases" chip inside (current behavior)

**List Mode Interactions:**
- Tap circle (○) → check off (✓ appears, product greyed out, moves to bottom)
- Tap checked circle (✓) → uncheck
- Swipe left → delete (with 3-second undo banner)
- Tap [-] or [+] → quantity ±1 immediately (no popup)
- Quantity 0 via [-] → product removed (with undo)
- Tap product name → product detail modal with "Edit Product" button
- Tap store name → opens store selection (S2)
- Tap search field → switch to search mode

**Recipe URL Mode (URL pasted into search field):**

When a URL is pasted, the search field switches to recipe import mode:

```
┌─────────────────────────────────────┐
│ [ALDI Logo]  Musterstr.        [⚙️]│
│ ┌─────────────────────────────────┐ │
│ │ 🔍 https://chefkoch.de/… [✕] │ │  ← URL detected
│ └─────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  🍳 Rezept wird geladen…     │  │  ← Loading state
│  │  ░░░░░░░░░░░░░░               │  │
│  └────────────────────────────────┘  │
│                                      │
└─────────────────────────────────────┘
```

After loading, a modal appears with the recipe title, servings picker, ALDI-only toggle, and ingredient confirmation list (see F20 in FEATURES-CORE.md).

**Search Mode Interactions:**
- Return key → add search term as generic product, exit search
- Tap on result → add specific product, exit search
- Paste URL → trigger recipe import flow (F20)
- Tap [✕] or back → exit search, list visible again

**Smart Default Mode (search field focused, no input yet):**

When the user taps the search field but hasn't typed anything, the app shows their most frequently purchased products (if sufficient purchase history exists).
┌─────────────────────────────────┐
│ [ALDI Logo]  Musterstr. ▾      │
│ ┌─────────────────────────────┐ │
│ │ 🔍 |                   [✕] │ │  ← Cursor in field, no text
│ └─────────────────────────────┘ │
│                                  │
│ ┌─────────────────────────────┐ │  ← Smart Default overlay
│ │                              │ │
│ │ Your top products:           │ │  ← Header
│ │                              │ │
│ │ Milsani Low-Fat Milk        │ │  ← Based on purchase_count
│ │   1.5% 1L           €0.99  │ │    + recency
│ │                              │ │
│ │ Bio Bananen                  │ │
│ │   1kg               €1.99  │ │
│ │                              │ │
│ │ Vollkornbrot                 │ │
│ │   500g              €1.29  │ │
│ │                              │ │
│ └─────────────────────────────┘ │
│                                  │
│ ┌─────────────────────────────┐ │
│ │  Keyboard                   │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘

- Shown only when `user_product_preferences` has ≥ 3 entries
- Max 10 products
- Ranking: see [SEARCH-ARCHITECTURE.md](SEARCH-ARCHITECTURE.md) §3.1
- Disappears as soon as user starts typing (switches to Search Mode)
- If insufficient history: shows empty field with "Recent Purchases" chip inside (current behavior)

---

### S2: Store Selection

Appears as overlay/modal over the list.

```
┌─────────────────────────────────┐
│                          [ ✕ ]  │
│ Select Store                    │
│ ┌─────────────────────────────┐ │
│ │ 🔍 Search stores...        │ │
│ └─────────────────────────────┘ │
│                                  │
│ ── Recently Visited ─────────── │
│ 📍 ALDI SÜD Musterstr. 12     │
│    Munich · 0.3 km             │
│ 📍 ALDI SÜD Hauptstr. 45      │
│    Munich · 2.1 km             │
│                                  │
│ ── Nearby ──────────────────── │
│ 📍 ALDI SÜD Bahnhofstr. 8     │
│    Munich · 0.8 km             │
│ ...                              │
└─────────────────────────────────┘
```

Sorted: recently visited first, then by distance. Tap selects store, re-sorts list, closes overlay.

---

### S3: Settings

Minimal screen, accessible via gear icon.

```
┌─────────────────────────────────┐
│ [←]  Settings                   │
│                                  │
│ Language                        │
│ [ German                  ▾ ]  │
│                                  │
│ Default Store                   │
│ [ ALDI SÜD Musterstr. 12  ▾ ] │
│ Used when GPS can't detect      │
│ your store.                     │
│                                  │
│ [ Admin Area → ]               │
│                                  │
│─────────────────────────────────│
│ About                           │
│ Version 0.1 (MVP)              │
│ A prototype project.            │
└─────────────────────────────────┘
```

---

### S4: Admin Area

Accessible via link on settings page or /admin URL. Password protected.

```
┌─────────────────────────────────┐
│ [←]  Admin                      │
│                                  │
│ ── Products ────────────────── │
│ [ Create Product ]              │
│ [ Bulk Import (CSV) ]           │
│ [ Manage Products → ]           │
│                                  │
│ ── Demand Groups ──────────── │
│ [ Assign Demand Groups ]        │
│                                  │
│ ── Crowdsourcing ──────────── │
│ [ Review Suggestions (12) → ]  │
│                                  │
│ ── Error Reports ──────────── │
│ [ View Errors (3) → ]          │
│                                  │
│ ── Data ────────────────────── │
│ [ Export Shopping Data ]        │
│ [ Manage Store Database ]       │
└─────────────────────────────────┘
```

---

## 4. Interaction Patterns

### 4.1 Swipe-to-Delete
Swipe left → red "Delete" surface (iOS Mail style) → product removed → 3-second undo banner at bottom.

### 4.2 Tap-to-Check (Circle Checkbox)
Circle (○) left of each item. Tap → checkmark (✓), brief animation, product greyed out and slides to bottom. Tap again → unchecked.

### 4.3 Quantity Change (Direct, No Popup)
[-] and [+] buttons visible next to quantity. Tap = immediate ±1. No popup, no picker. Quantity 0 → product removed with undo.

### 4.4 Pull-to-Refresh
Pull down → manual cloud sync. Brief status display.

### 4.5 Last Product Checked
Brief success animation (subtle, ALDI-style). Auto-switch to home after 1-2 seconds. Trip archived in background.

---

## 5. Design Language

### 5.1 Color Palette (ALDI SÜD Brand)
- **Primary:** ALDI Blue (#00005f or similar)
- **Secondary:** ALDI Orange/Yellow (accent for buttons/highlights)
- **Background:** White (#FFFFFF)
- **Text:** Dark grey (#333333)
- **Greyed out (checked):** Light grey (#CCCCCC)
- **Error/Delete:** Red (#E74C3C)
- **Success:** Green (#27AE60)
- **Category Color Coding (Shopping Order mode only):** Each of the 19 app categories has a single bold colour used for both item border and category label text. Colours are inspired by typical ALDI product/packaging appearance and meet WCAG 4.5:1 contrast on white. Applied to unchecked, non-deferred items only. Checked/deferred items retain standard grey styling. Defined in `src/lib/categories/category-colors.ts`. Colour assignments: dark gold (Bakery), green (Fruits & Vegetables), red (Fresh Meat & Fish), blue (Dairy), teal (Chilled Convenience), blue-grey (Freezer), brown (Pantry, Breakfast), dark blue (Non-Alcoholic Beverages), dark green (Alcoholic Beverages), red-brown (Snacking), pink (Health, Beauty & Baby), neutral grey (Household, Electronics, Fashion, Home Improvement, Outdoor/Leisure, Services, Sonstiges).

### 5.2 Typography
- Clear, readable sans-serif font
- Product names: normal size. Category headers: smaller, uppercase, ALDI blue
- Category label below product name: 11px, colored per category in Shopping Order mode (grey in My Order mode)
- Prices: right-aligned. Total: larger, bold

### 5.3 Spacing & Touch Targets
- Minimum tappable element size: 44x44px (Apple guideline)
- Sufficient spacing between list items to prevent accidental taps
- Important: enough distance between "check off" and "change quantity"

### 5.4 Animations
- Subtle and fast – never longer than 300ms
- Check off: short slide + fade. Delete: slide left. Add: brief highlight
- Never delay interaction

---

## 6. Responsive Behavior

- **Smartphone (primary):** 320px–428px width, single column, touch-optimized
- **Tablet:** Same functionality, more white space
- **Desktop:** Functional (for admin tasks), centered max-width ~480px

---

## 7. Empty States

- **Empty list:** "Your list is empty" + prominent search field + "Fill with typical items" button
- **No search results:** "No product found for '[term]'" + "Suggest Product" button + Return hint
- **Search field focused, no history:** Empty search field with "Recent Purchases" chip inside (no Smart Default shown)
- **Search field focused, has history:** Smart Default with personal top products (see Smart Default Mode above)
- **No store detected:** "Store could not be detected" + "Select store manually" button

---

## 8. Vision: Future Shopping Mode (Not MVP)

When store is detected, app switches to optimized shopping mode: larger tap targets, simplified display, no search field visible (expandable), larger font, progress display "5 of 12 products ✓", screen stays active (no auto-lock).

---

*Last updated: 2026-03-01*
