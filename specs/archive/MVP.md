# MVP.md – Minimum Viable Product Definition

## 1. MVP Goal

A functional prototype as a Progressive Web App (PWA) covering the core shopping workflow: create shopping list → enter store → list is automatically sorted by aisle order → check off products → done.

The MVP serves as a showcase for an internal presentation at ALDI SÜD and must convincingly demonstrate that the concept works.

---

## 2. MVP Scope: What's Included

### 2.1 Smart Product Input
- Search field with autocomplete
- **Generic input:** User types "Milk" and adds "Milk" (generic) with one tap
- **Specific input:** Below the generic option, specific ALDI products from the database matching the search term appear
- After adding: quantity adjustable or immediately enter next product
- Frequently purchased products appear higher (personalized ranking)

### 2.2 Product Database
- Initial population via admin UI (replaced once official database connection exists)
- Crowdsourcing: users can contribute products
- Products contain: name, category, price (if known), assortment type (daily range / special)

### 2.3 Automatic Store Detection & Aisle Sorting
- **GPS-based store detection:** App automatically recognizes which ALDI store the user is in
- **Manual selection:** Fallback if GPS doesn't work
- **Store-specific sorting:** List sorted in product order of the detected store
- **Category pre-sorting:** Products grouped by categories even during input
- **Fallback for unknown stores:** Average of all known stores used as starting assumption
- **Learning algorithm (basic version):** System learns from check-off order (details in LEARNING-ALGORITHMS.md)

### 2.4 Shopping List In-Store
- List shows products in calculated aisle order
- Check off by tap → product greyed out, moves to bottom
- Remove by swipe
- Error button: user can signal that sorting is wrong

### 2.5 Simple Price Estimation
- For specific products with known price: sum displayed
- Generic entries: "price unknown" – not included in sum
- Display: "Estimated price: €XX.XX (3 of 12 products without price)"

### 2.6 Shopping Analytics (Background Data Collection)
- All shopping trips logged: date, products, store, prices
- Shopping duration measured: time from first to last check-off
- Data stored but not visualized in MVP

### 2.7 Account Model (MVP)
- Automatic anonymous account (generic ID)
- No registration in MVP
- All data stored in cloud, bound to anonymous ID

### 2.8 Offline Capability (DEFERRED)
- Deferred to later phase. MVP is online-only.
- Full offline spec remains in OFFLINE-STRATEGY.md

### 2.9 Multi-language
- App UI in German and English
- i18n implemented from the start
- Product names are language-independent

### 2.10 Design
- ALDI SÜD design language (colors, typography)
- Best-in-class usability (oriented at top consumer apps)
- Mobile-first, optimized for one-hand smartphone operation

---

## 3. MVP Scope: What's NOT Included

| Feature | Planned For | Reason |
|---------|-------------|--------|
| Personal account / registration | Phase 3 | MVP demonstrates concept |
| Shared family lists | Phase 3 | Requires account model |
| Real-time sync between devices | Phase 3 | Requires account model |
| Native iOS/Android app | Phase 4 | PWA sufficient for prototype |
| Push notifications | Phase 4 | Makes sense with native app + family feature |
| Price comparison with LIDL etc. | Phase 5 | Requires separate product databases |
| Recipe import | Phase 5 | Nice-to-have |
| Voice assistant integration | Phase 5 | Nice-to-have |
| Official product database API | Phase 2 | MVP uses manual + crowdsourcing |
| Analytics dashboard | Phase 2+ | Data collected but not visualized in MVP |
| Full GDPR compliance | Pre-launch | Implemented before public launch |

---

## 4. MVP User Flow (End-to-End)

### At Home: Create List
```
1. Open app
2. Tap search field → type "Milk"
3. Immediately appears:
   - [+ Milk]                            ← generic, one tap
   - Milsani Fresh Whole Milk 3.5% 1L   ← specific
   - Milsani Low-Fat Milk 1.5% 1L       ← specific (★ frequently bought)
4. User taps desired product → added to list
5. Optional: adjust quantity
6. Enter next product or close list
7. Bottom: "Estimated price: €23.40 (2 products without price)"
```

### In Store: Shopping
```
1. Open app
2. GPS detects: "ALDI SÜD Musterstraße 12, Munich"
   - If not detected: select store manually
3. List automatically sorts by this store's aisle order
4. Walk through store:
   - Product in cart → tap to check off
   - Product not found → swipe to remove
   - Sorting wrong → error button
5. Last product checked → shopping complete
6. Background: shopping data + check-off order saved
```

---

## 5. Technical MVP Requirements

- **Format:** Progressive Web App (PWA), installable on smartphone
- **Online:** MVP requires internet. Offline mode in later phase
- **Performance:** Smooth with up to 4,000 active products in database
- **Browser support:** iOS Safari (15+), Android Chrome (10+)
- **GPS:** For store detection, with manual selection fallback
- **Responsive:** Mobile-first with dedicated tablet (768px+) and desktop (1024px+) layouts. Desktop features: top navigation bar, split-view (list + search side by side), hover action buttons, mouse wheel zoom, keyboard shortcuts, right-click rename. See `UI.md` §6 for full responsive specification.

---

## 6. Success Criteria

The MVP is successful when it convincingly demonstrates in a live demo:

1. **Fast list creation:** A shopping list with 10 products created in under 2 minutes
2. **Smart search:** Autocomplete with generic and specific results works smoothly
3. **Automatic sorting:** List correctly sorts by aisle order when entering a known store
4. **Fallback works:** Average sorting makes sense for unknown stores
5. **Specials:** Availability display helps user estimate if a special is still in stock
6. **Learning effect visible:** Sorting noticeably improves after a few shopping trips
7. **Price estimation:** An orientation price is displayed

---

*Last updated: 2025-02-22*
