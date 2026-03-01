# LEARNING-ALGORITHMS.md – Self-Learning Algorithms

> Describes how the app learns from user behavior.
> The learning algorithm is the app's core differentiator.
> For the underlying data model see DATA-MODEL.md.

---

## 1. Overview: What Does the App Learn?

| Level | What Is Learned | Benefit |
|-------|----------------|---------|
| **Aisle order per store** | In which order product categories appear in a specific store | List sorted in walking order |
| **Personal preferences** | Which products a user buys regularly | Search shows relevant products first |
| **Automatic category assignment** | Which category an unknown product belongs to | New/generic products sorted correctly |

---

## 2. Aisle Order Algorithm (Core)

### 2.1 Goal

Calculate a product category order for each ALDI SÜD store that matches the actual store layout. A user working through the list top to bottom should only need to walk through the store once.

### 2.2 Information Sources (Layers)

Layers ordered by priority:

**Layer 1: Store-Specific Check-Off Data (highest priority)**
- Source: Validated checkoff sequences from this store
- Logic: If many users in Store X first check off fruit, then bread, then dairy → this order is assumed as aisle order
- Confidence grows with number of data points
- Minimum: ~5 validated trips for first useful results
- Optimum: ~20 validated trips for reliable sorting

**Layer 2: Average Across All Stores (fallback)**
- Source: AggregatedAisleOrder – average aisle order of all stores
- Logic: ALDI SÜD stores are similarly structured. If 80% have fruit at the entrance, that's a good assumption for unknown stores
- Used when a store has insufficient own data
- Weighting: Less own data → stronger influence from average

**Layer 3: Category Clustering (base fallback)**
- Source: General knowledge about product groupings
- Logic: Even without user data, apples and pears are adjacent, cheese and milk are close together, frozen products share a freezer
- Used as initial base sorting before any user data exists
- Based on default_sort_position of categories

**Layer 4: Specials Positioning**
- Specials typically stand in a specific area (often middle of store)
- Products from the same promotion week are grouped together
- The specials zone position is learned like any other category

### 2.3 Weighting Model

```
For a specific store with N validated trips:

If N = 0:
  → Use category clustering (Layer 3)

If N < Threshold_Minimum (e.g. 5):
  → Weighted mix: 70% average all stores (Layer 2), 30% own data (Layer 1)

If N >= Threshold_Minimum and N < Threshold_Optimal (e.g. 20):
  → Own data share rises linearly with N, average share drops accordingly

If N >= Threshold_Optimal:
  → Primarily own data (Layer 1), average only as sanity check
```

### 2.4 Calculating Aisle Order from Check-Off Sequences

The algorithm works on **three hierarchical levels**. The same pairwise comparison algorithm is applied at each level:

**Level 1: Demand Groups** (coarsest, ~15-20 groups)
- Determines order of major store areas
- e.g.: Fruits & Vegetables → Bread & Bakery → Fresh & Chilled → Frozen → ...
- Needs least data (~5 trips for useful results)

**Level 2: Demand Sub-Groups within a Demand Group** (~3-8 per group)
- Determines order within a store area
- e.g. within "Fruits & Vegetables": Apples & Pears → Citrus → Berries → Salads → Root Vegetables
- Needs more data (~10-15 trips for useful results)

**Level 3: Products within a Sub-Group** (finest)
- Determines order of individual products
- e.g. within "Apples & Pears": Pink Lady → Elstar → Pears → Table Apples
- Needs most data (~20-30 trips containing both products)

**Each level has its own layered model:**

```
For each level (Group / Sub-Group / Product):

Layer 1: Store-specific data
  → Pairwise comparisons from checkoff sequences in this store

Layer 2: Average across all stores
  → Fallback when insufficient store-specific data

Layer 3: Default sorting
  → Level 1: Generic ALDI layout
  → Level 2: Alphabetical or by popularity within group
  → Level 3: By popularity_score within sub-group

Weighting between layers is independent per level.
A store may have enough data for Level 1 (→ 90% own data),
but not yet for Level 3 (→ 70% average, 30% own data).
```

**Algorithm per level (identical for all three):**

1. For each element pair (A, B) at this level: count how often A came before B, how often B before A
2. Calculate probability: P(A before B) = Count(A before B) / (Count(A before B) + Count(B before A))
3. Convert pairwise probabilities into overall ordering (e.g. topological sort or ranking algorithm)
4. Calculate confidence per position: high agreement between sequences = high confidence

**Overall list sorting:**

```
1. Sort Demand Groups by learned Level 1 order
2. Within each Demand Group: sort Sub-Groups by learned Level 2 order
3. Within each Sub-Group: sort Products by learned Level 3 order
```

### 2.5 Handling Contradictory Data

Not all users walk the store in the same direction.

- **Detection:** If pairwise probabilities are near 50/50, this indicates two walking directions
- **MVP:** Majority direction is used
- **Later:** Could learn per-user preferred direction

---

## 3. Validating Check-Off Sequences

### 3.1 Problem

Not every check-off sequence reflects the actual walking order. Users who check everything off after shopping provide no useful data.

### 3.2 Detection Characteristics

| Feature | Real-Time Checker | After-The-Fact Checker |
|---------|------------------|----------------------|
| Time gaps | Varying (30s – 5 min between products) | Very short (< 3s between products) |
| Total duration | Realistic (15 – 60 min) | Very short (< 2 min for all) |
| Order | Plausible walking order | Often identical to input order |
| Pattern | Non-uniform timestamps | Uniform, rapid timestamps |

### 3.3 Validation Rules (MVP Starting Point)

Pairwise learning requires **two independent conditions** to both be true:

**Condition 1: GPS-confirmed in-store presence**
- The app polls GPS every 90 seconds while open
- The user must be within 100 m of a known store for in-store status to activate
- Hysteresis: status only reverts to "not in store" when distance exceeds 200 m (avoids flickering at boundaries)
- The `gps_confirmed_in_store` flag is stored on the list in IndexedDB
- If the store was only set via the default-store fallback (no GPS confirmation), learning is skipped

**Condition 2: Time-based checkoff pattern**

A sequence is marked **valid** when:
- At least 5 products checked off
- Total duration (first to last check-off) at least 3 minutes
- Average gap between check-offs at least 15 seconds
- No more than 50% of gaps under 5 seconds

A sequence is marked **invalid** when:
- All products checked off within 60 seconds
- Average gap under 5 seconds

**Grey zone:** Sequences that are neither clearly valid nor invalid are included with lower weight.

Both conditions must pass. This ensures that learning only happens when the user is physically in the store AND checking off items one by one during the actual shopping trip.

---

## 4. Personalized Product Ranking – Data Collection

### 4.1 Goal

The app learns which products a user buys regularly and uses this to personalize search results and product suggestions.

### 4.2 Data Sources

| Source | Table | Key Fields | When Updated |
|---|---|---|---|
| Shopping list additions | `list_items` | `product_id`, `added_at` | Every time user adds a product |
| Completed trips | `trip_items` | `product_id`, `checked_at` | When shopping trip is archived |
| Receipt scans | `receipt_items` | `product_id`, `created_at` | After receipt OCR processing |
| Aggregated preferences | `user_product_preferences` | `purchase_count`, `last_purchased_at` | Computed from above sources |

### 4.3 Aggregation Logic

`user_product_preferences` is the canonical per-user, per-product preference table. It aggregates signals from all data sources:
For each (user_id, product_id):
purchase_count = COUNT(list_items) + COUNT(trip_items with was_removed=false) + COUNT(receipt_items)
last_purchased_at = MAX(checked_at, receipt.purchase_date, list_item.added_at)

## 5. Automatic Category Assignment

### 5.1 Logic (3-Layer Model)

```
User enters "Pink Lady":

1. Check: Does "Pink Lady" exist in product database?
   → Yes: Take category from DB → DONE
   → No: Continue to step 2

2. Check: Does "Pink Lady" exist in alias table?
   → Yes: Take category from alias table → DONE
   → No: Continue to step 3

3. Check: Has this user entered "Pink Lady" before?
   → Yes: Take category from previous entry → DONE
   → No: Continue to step 4

4. Ask AI language model (if online)
   → Claude API: "Which supermarket category does 'Pink Lady' belong to?"
   → Answer: "Fruits & Vegetables"
   → Save to alias table (for all future users)
   → DONE

5. Fallback (if offline or AI unavailable)
   → Assign category "Other"
   → On next online connection: retry AI and correct
```

### 5.2 Alias Table

Maps terms, brand names, private labels and colloquial expressions to categories.

**Initial population:** ~500+ common terms (known brands, ALDI private labels, colloquial terms). Table grows automatically through AI assignments. Admin can correct entries (source = "manual", confidence = 1.0).

### 5.3 Cost Management

Each AI assignment costs minimally (~few cents). Results are cached in alias table, so the same query is never made twice. After the ramp-up phase, API costs drop to near zero.

---

## 6. Typical Products Algorithm

### 6.1 Goal

User taps "Fill with typical products" → app fills list with regularly purchased products.

### 6.2 MVP Logic

```
For each user:

1. Take all products from last N trips (e.g. N = 10)
2. Count how often each product appeared
3. Every product on the list in at least 50% of trips = "typical product"
4. Add all typical products to new list
5. Use the most recently used quantity for each product
```

**Edge cases:**
- User has fewer than 3 trips → feature not available (button hidden)
- Both generic and specific products considered
- If user last chose the specific product, the specific version is used

### 6.3 Future Algorithm (Intelligent)

Factors to consider: day of week, seasonality, purchase interval, time since last purchase.

---

## 7. Learning Cycle (Full Process)

```
┌─────────────────────────────────────────────────────┐
│                  SHOPPING STARTS                      │
│                                                       │
│  User opens app                                      │
│  → GPS detects store (100 m radius)                  │
│  → If found: gps_confirmed_in_store = true           │
│  → "Im Laden" badge shown in header (MVP)            │
│  → Aisle order loaded (best available data)          │
│  → List sorted in shopping order                     │
│  → GPS polling starts (every 90 s)                   │
│    → Hysteresis: enter 100 m / leave 200 m           │
│    → Badge updates when status changes               │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│                  SHOPPING IN PROGRESS                 │
│                                                       │
│  User checks off products                            │
│  → Timestamp saved per product                       │
│  → GPS continues polling in background               │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│                  SHOPPING COMPLETE                     │
│                                                       │
│  Last product checked off                            │
│  → GPS polling stopped                               │
│  → ShoppingTrip archived                             │
│  → CheckoffSequence saved                            │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│             DUAL VALIDATION                           │
│                                                       │
│  Gate 1: Was user in store? (GPS)                    │
│  → gps_confirmed_in_store must be true               │
│  → If false (default store only): skip learning      │
│                                                       │
│  Gate 2: Time-based checkoff pattern                 │
│  → Check time gaps, total duration                   │
│  → is_valid = true / false / grey zone               │
└──────────────────┬───────────────────────────────────┘
                   │
          ┌────────┴────────┐
          │                 │
      Both pass        Either fails
          │                 │
          ▼                 ▼
┌─────────────────┐  ┌──────────────────┐
│ LEARN           │  │ IGNORE           │
│                 │  │                  │
│ Update aisle    │  │ Sequence not     │
│ order for       │  │ used for aisle   │
│ this store      │  │ order            │
│                 │  │                  │
│ Recalculate     │  │ (Shopping trip   │
│ aggregated      │  │  still saved     │
│ aisle order     │  │  for history)    │
│                 │  │                  │
│ Update user     │  │                  │
│ preferences     │  │                  │
└─────────────────┘  └──────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│             NEXT SHOPPING TRIP BENEFITS               │
│                                                       │
│  → Aisle order is more accurate                      │
│  → Personal favorites are more current               │
│  → Typical products list is better                   │
│  → Category assignment has more data                 │
└─────────────────────────────────────────────────────┘
```

---

## 8. Cold Start Problem

### 8.1 New Store (No Data)
- **Day 1:** Category clustering (Layer 3). Fruits first (typical ALDI entrance), then bread, dairy, meat, frozen, dry goods, drinks, household, specials
- **Week 1 (~5-10 trips):** First own data, mix 30% own + 70% average. Noticeable improvement
- **Month 1 (~50+ trips):** Reliable aisle order, high confidence

### 8.2 New User (No Personal History)
- Search shows global ranking. "Typical products" disabled (needs 3+ trips). Aisle order based on store data (user-independent). After 2-3 trips: first personalization visible

### 8.3 Completely New App (No Users, No Store Data)
- Everything based on category clustering. Initial category order must be well-designed (one-time manual work). Learning cycle begins with first users. App improves week by week.

---

## 9. Error Feedback and Self-Correction

### 9.1 Error Button (MVP)
User reports "sorting is wrong". Saved with context: store, current sorting, timestamp. Admin can view reports.

### 9.2 Automatic Analysis (Later)
- **Clustering:** Many errors for one store → lower confidence, fall back to average
- **Correlation:** Errors after specific sorting change → revert change
- **Store renovation:** Sudden spike in errors → reset aisle data and relearn

### 9.3 Manipulation Protection
- Single user cannot significantly influence aisle order (data aggregated across many users)
- Outliers in checkoff sequences are statistically detected and downweighted
- Error reports from single user have limited influence

---

## 10. Metrics & Success Measurement

| Metric | Description | Target |
|--------|-------------|--------|
| **Sorting Consistency** | How often does predicted aisle order match actual check-off order | > 80% after 20 trips per store |
| **Error Rate** | Share of trips with error report | < 10% after ramp-up |
| **Shopping Duration Trend** | Does average shopping duration decrease over time | Visible decline |
| **Personalization Hit Rate** | How often does user select a top-3 suggested product | > 60% |
| **Typical Products Acceptance** | How many auto-suggested products remain on list | > 70% |

> Metrics are collected and stored in MVP. Dashboard for analysis comes in a later phase.

---

*Last updated: 2026-02-28*
*See also: SEARCH-ARCHITECTURE.md (ranking), DATA-MODEL.md (schema)*
