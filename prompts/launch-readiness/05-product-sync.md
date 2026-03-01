# Prompt: Block 5 – Produkt-Sync optimieren (Delta-Sync)

## Empfohlenes Modell: Opus 4.6 Max Mode (Performance-kritisch)

## Abhängigkeit: Keine (kann jederzeit umgesetzt werden)

---

## Kontext

`src/lib/products-context.tsx` lädt bei **jedem App-Start** den gesamten Produktkatalog aus Supabase (paginiert in 1000er-Blöcken). Bei ~500 Produkten sind das ~100 KB, bei 4.000+ Produkten ~800 KB. Es gibt keinen Cache — kein `localStorage`, kein IndexedDB, kein `stale-while-revalidate`.

Bei 100+ Nutzern, die täglich die App öffnen: ~100 GB Supabase-Bandwidth/Monat allein für Produktdaten (Supabase Free Tier: 5 GB).

Das IndexedDB-Schema für Produkte existiert bereits in `src/lib/db/indexed-db.ts` (`db.products`), wird aber nicht für Caching genutzt.

---

## Aufgabe

### 1. `ProductsProvider` umbauen: IndexedDB als Cache + Delta-Sync

**Neuer Ablauf:**

```
App-Start
    │
    ▼
Lese Produkte aus IndexedDB (instant, < 10ms)
    │
    ├── Produkte vorhanden → Zeige sofort an (stale data OK)
    │     │
    │     ▼
    │   Im Hintergrund: Delta-Sync (updated_at > lastSync)
    │     │
    │     └── Neue/geänderte Produkte → IndexedDB updaten → State aktualisieren
    │
    └── Keine Produkte (erster Start) → Full-Load aus Supabase → IndexedDB befüllen
```

### 2. Implementierung in `src/lib/products-context.tsx`

```typescript
import { db } from "@/lib/db";

const LAST_SYNC_KEY = "products-last-sync";

async function loadFromCache(country: string): Promise<Product[]> {
  const cached = await db.products
    .filter((p) => p.country === country && p.status === "active")
    .toArray();
  return cached.map(rowToProduct);
}

async function deltaSync(country: string): Promise<Product[]> {
  const supabase = createClientIfConfigured();
  if (!supabase) return [];

  const lastSync = localStorage.getItem(`${LAST_SYNC_KEY}-${country}`);
  const now = new Date().toISOString();

  let query = supabase
    .from("products")
    .select("*")
    .eq("country", country);

  if (lastSync) {
    // Only fetch products updated since last sync
    query = query.gt("updated_at", lastSync);
  }

  // Also fetch active products (for status changes)
  query = query.order("updated_at", { ascending: true });

  const allRows: Record<string, unknown>[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error("[ProductsSync] Delta sync failed:", error.message);
      return [];
    }
    const rows = data ?? [];
    allRows.push(...rows);
    hasMore = rows.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  if (allRows.length > 0) {
    // Upsert into IndexedDB
    const products = allRows.map(rowToProduct);
    await db.products.bulkPut(
      products.map((p) => ({ ...p, id: undefined }))
    );

    // Handle deactivated products
    const inactiveIds = products
      .filter((p) => p.status !== "active")
      .map((p) => p.product_id);
    if (inactiveIds.length > 0) {
      await db.products
        .where("product_id")
        .anyOf(inactiveIds)
        .delete();
    }

    console.info(`[ProductsSync] Delta: ${allRows.length} products synced`);
  }

  localStorage.setItem(`${LAST_SYNC_KEY}-${country}`, now);

  // Return full list from IndexedDB
  return loadFromCache(country);
}
```

### 3. Provider-Logik anpassen

```typescript
export function ProductsProvider({ children }: { children: ReactNode }) {
  const { country } = useCurrentCountry();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    if (country === null) {
      setProducts([]);
      setLoading(false);
      return;
    }

    // Step 1: Load from cache (instant)
    const cached = await loadFromCache(country);
    if (cached.length > 0) {
      setProducts(cached);
      setLoading(false);
    }

    // Step 2: Delta sync in background
    const synced = await deltaSync(country);
    if (synced.length > 0) {
      setProducts(synced);
    } else if (cached.length === 0) {
      // First start, no cache → full load already happened via deltaSync
      const fresh = await loadFromCache(country);
      setProducts(fresh);
    }
    setLoading(false);
  }, [country]);

  // ... rest unchanged ...
}
```

### 4. IndexedDB-Schema prüfen

In `src/lib/db/indexed-db.ts` ist `products` bereits definiert mit Index auf `product_id`. Für den Delta-Sync brauchen wir einen Index auf `country`:

```typescript
this.version(6).stores({
  products: "++id, product_id, name_normalized, category_id, status, name, country",
});
```

**Achtung:** Dexie-Versionierung — die neue Version (6) muss die bestehenden Stores übernehmen (Dexie merged automatisch, aber prüfen).

### 5. `refetch()` Funktion

Die `refetch()`-Funktion (aufgerufen nach "Produkt anlegen") soll einen Mini-Sync auslösen:
```typescript
const refetch = useCallback(async () => {
  // Force delta sync, then update state
  const synced = await deltaSync(country);
  if (synced.length > 0) setProducts(synced);
  else {
    const cached = await loadFromCache(country);
    setProducts(cached);
  }
}, [country]);
```

---

## Fallstricke

1. **Dexie `bulkPut` braucht einen eindeutigen Key:** Das `product_id`-Feld muss als Key oder Index existieren. Der Autoincrement-Key `++id` ist der Primary Key. `bulkPut` basiert auf dem Primary Key → wir müssen `product_id` als Primary Key verwenden oder `put` einzeln aufrufen. **Empfehlung:** Schema ändern auf `product_id` als Primary Key statt `++id`:
   ```typescript
   products: "product_id, name_normalized, category_id, status, name, country"
   ```
   Das erfordert eine Dexie-Versionserhöhung mit Datenmigration.

2. **Erste Nutzung vs. Update:** Beim allerersten Start (kein `lastSync`) lädt `deltaSync` ALLE Produkte (kein `.gt("updated_at", ...)`). Das ist der Full-Load. Danach nur noch Deltas.

3. **`useProducts()` Interface bleibt gleich:** Die Consumer (`product-search.tsx`, `use-list-data.ts` etc.) nutzen `const { products, loading, refetch } = useProducts()`. Dieses Interface darf sich nicht ändern.

4. **Country-Wechsel:** Wenn der Nutzer das Land wechselt (DE ↔ AT), muss der Cache für das neue Land separat geladen werden. `lastSync` ist pro Country gespeichert.

5. **Offline-Szenario:** Wenn Supabase nicht erreichbar ist, werden die cached Produkte angezeigt (graceful degradation). Kein Fehler-UI nötig — die Daten sind nur evtl. nicht ganz aktuell.

---

## Testplan

- [ ] Erster Start (leerer Cache): Alle Produkte werden geladen und in IndexedDB gespeichert
- [ ] Zweiter Start: Produkte erscheinen sofort (aus Cache), Delta-Sync im Hintergrund
- [ ] Neues Produkt in Supabase anlegen → nächster App-Start zeigt es an
- [ ] Produkt deaktivieren → nach Sync nicht mehr in der Suche
- [ ] Country wechseln (DE → AT) → separate Cache-Daten
- [ ] Offline (Supabase nicht erreichbar) → cached Produkte werden angezeigt, kein Crash
- [ ] Performance: App-Start mit Cache < 500ms (statt 2-3s mit Full-Load)

---

## Specs aktualisieren

- `specs/ARCHITECTURE.md` → Produkt-Sync-Strategie dokumentieren
- `specs/CHANGELOG.md` → Eintrag hinzufügen
