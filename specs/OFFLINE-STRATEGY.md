# OFFLINE-STRATEGY.md – Offline Strategy

> **STATUS: DEFERRED – Not in MVP. MVP is online-only.**
> This spec is preserved for Phase 2 implementation.
> Describes how the app works without internet connection.

---

## 1. Core Principle

The app stores all data needed in-store **locally on the device**. The user ideally notices no difference between online and offline usage. Cloud sync happens automatically in the background when a connection is available.

---

## 2. What Must Work Offline?

### Fully Offline (No Restrictions)

| Function | Offline Behavior |
|----------|-----------------|
| Display shopping list | From local storage |
| Check off products | Stored locally, synced later |
| Undo check-off | Local |
| Remove products by swipe | Stored locally, synced later |
| Change quantities | Stored locally, synced later |
| Display sorting | Based on last synced aisle order data |
| Error button | Report stored locally, synced later |
| Price estimation | Based on locally cached prices |
| Complete shopping trip | Archived locally, synced later |

### Limited Offline (With Fallback)

| Function | Online | Offline Fallback |
|----------|--------|-----------------|
| Product search | Full cloud DB | Locally cached product catalog |
| Store detection (GPS) | GPS works without internet, store matched from local DB | Also works offline |
| Autocomplete | Full product catalog | Cached catalog |

### Not Available Offline

| Function | Reason |
|----------|--------|
| Suggest new product (crowdsourcing) | Must write to cloud (queued locally) |
| Admin functions | Require cloud access |
| Receive other users' data | Requires sync |

---

## 3. Local Storage – What Is Cached?

### 3.1 Initial Download (First App Start)

| Data | ~Size | Description |
|------|-------|-------------|
| Product catalog | ~1-2 MB | All active products (~4,000: name, category, price, brand, type) |
| Categories | < 10 KB | All categories with icons and default sorting |
| Store database (DE + AT) | ~200 KB | All ALDI SÜD stores with address and GPS coordinates |
| Aggregated aisle order | < 50 KB | Average aisle orders (fallback) |
| UI texts (i18n) | < 50 KB | All translations |

Total initial cache: under 2 MB.

### 3.2 Ongoing Updates

| Data | Frequency | Method |
|------|-----------|--------|
| Product catalog | Every app start (if online) | Delta sync |
| Prices | Every app start (if online) | Delta sync |
| Store database | Weekly | Delta sync |
| Aisle order for current/default store | Every app start | Full download (small) |
| Aggregated aisle order | Daily | Full download (small) |
| User product preferences | After each trip | Bidirectional sync |

---

## 4. Synchronization

### 4.1 Sync Triggers

Automatic sync on: app start (if online), offline→online transition, after completing a trip, regular intervals (e.g. every 5 min while app open), manual pull-to-refresh.

### 4.2 Sync Priority (Limited Bandwidth)

1. **Highest:** Active shopping list (upload + download)
2. **High:** Aisle order for current/default store
3. **Medium:** Product catalog updates, price updates
4. **Low:** Shopping history, checkoff sequences, error reports
5. **Lowest:** Store database updates, aggregated aisle orders

### 4.3 Conflict Resolution

**MVP (single user):** Last-write-wins per list item. Additions are never overwritten – if local and cloud have different new products, both are kept.

**Later (family feature):** Merge instead of overwrite, tombstone principle for deletions, user notification for conflicts.

---

## 5. Technical Implementation

- **Service Worker:** Intercepts network requests, serves from cache when offline
- **IndexedDB:** All structured data stored locally (works in all modern browsers)
- **Offline Queue:** Changes queued and processed on reconnection with exponential backoff retry

---

## 6. UX

- **Online:** No indicator (normal state)
- **Offline:** Subtle banner: "Offline – changes will sync when you're back online"
- **Stale data (>7 days):** "Product data may not be current" (informational only)
- **First start without internet:** "Please connect to set up the app. After that it works offline too."
- **No blocking modals or forced updates**

---

## 7. Offline Guarantees

| Guarantee | Description |
|-----------|-------------|
| **No data loss** | All offline changes synced on next connection |
| **Full in-store functionality** | List, check-off, sorting, error reporting – all work offline |
| **Transparency** | User always knows if online or offline |
| **No blocking** | App never blocks usage due to missing connection (except first start) |
| **Automatic sync** | User doesn't need to manage synchronization |

---

*Last updated: 2025-02-22*
*Status: Deferred to Phase 2*
