"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { Product } from "@/types";
import {
  mapSupabaseProductRowToProduct,
  type ProductRow,
} from "@/lib/products/map-supabase-product-row";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { useCurrentCountry } from "@/lib/current-country-context";
import { log } from "@/lib/utils/logger";
import { setSearchProducts } from "@/lib/search/local-search";
import { indexProducts } from "@/lib/search/search-indexer";
import { loadPurchaseHistory } from "@/lib/search/purchase-history";

function lastSyncKey(country: string): string {
  return `products-last-sync-${country}`;
}

function isIndexedDBAvailable(): boolean {
  try {
    return typeof window !== "undefined" && typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}

async function getDb() {
  const { db } = await import("@/lib/db");
  return db;
}

async function loadFromCache(country: string): Promise<Product[]> {
  if (!isIndexedDBAvailable()) return [];
  try {
    const db = await getDb();
    const rows = await db.products
      .where("country")
      .equals(country)
      .and((p) => p.status === "active")
      .toArray();
    return rows as Product[];
  } catch (err) {
    log.error("[ProductsSync] IndexedDB read failed:", err);
    return [];
  }
}

async function fetchAllFromSupabase(
  country: string,
  since?: string,
): Promise<{ rows: ProductRow[]; error: boolean }> {
  const supabase = createClientIfConfigured();
  if (!supabase) return { rows: [], error: true };

  const allRows: ProductRow[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from("products")
      .select("*")
      .eq("country", country);

    if (since) {
      query = query.gt("updated_at", since);
    } else {
      query = query.eq("status", "active");
    }

    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, error } = await query;
    if (error) {
      log.error("[ProductsSync] Supabase fetch failed:", error.message);
      return { rows: allRows, error: true };
    }
    const rows = (data ?? []) as ProductRow[];
    allRows.push(...rows);
    hasMore = rows.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }
  return { rows: allRows, error: false };
}

async function deltaSync(country: string): Promise<Product[] | null> {
  const lastSync = typeof window !== "undefined"
    ? localStorage.getItem(lastSyncKey(country))
    : null;

  const isFullLoad = !lastSync;

  const { rows, error } = await fetchAllFromSupabase(
    country,
    lastSync ?? undefined,
  );

  if (error && rows.length === 0) return null;

  const products = rows.map(mapSupabaseProductRowToProduct);

  if (isIndexedDBAvailable()) {
    try {
      const db = await getDb();

      if (isFullLoad) {
        await db.products.where("country").equals(country).delete();
        if (products.length > 0) {
          await db.products.bulkPut(products);
        }
        console.info(`[ProductsSync] Full load: ${products.length} products (first start)`);
      } else {
        const active = products.filter((p) => p.status === "active");
        const inactive = products.filter((p) => p.status !== "active");

        if (active.length > 0) {
          await db.products.bulkPut(active);
        }
        if (inactive.length > 0) {
          await db.products.bulkDelete(inactive.map((p) => p.product_id));
        }
        console.info(`[ProductsSync] Delta: ${products.length} products synced from Supabase`);
      }

      if (typeof window !== "undefined") {
        const maxUpdatedAt = products.reduce(
          (max, p) => (p.updated_at > max ? p.updated_at : max),
          lastSync ?? "",
        );
        if (maxUpdatedAt) {
          localStorage.setItem(lastSyncKey(country), maxUpdatedAt);
        }
      }

      const fullList = await db.products
        .where("country")
        .equals(country)
        .and((p) => p.status === "active")
        .toArray();
      return fullList as Product[];
    } catch (err) {
      log.error("[ProductsSync] IndexedDB write failed:", err);
      if (isFullLoad) return products;
      return null;
    }
  }

  // IndexedDB not available: return fetched products directly (full-load only)
  if (isFullLoad) return products;
  return null;
}

interface ProductsContextValue {
  products: Product[];
  loading: boolean;
  /** Call after creating a product so the list includes the new entry. */
  refetch: () => Promise<void>;
}

const ProductsContext = createContext<ProductsContextValue | null>(null);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const { country } = useCurrentCountry();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchSeqRef = useRef(0);

  const syncProducts = useCallback(async () => {
    if (country === null) return;
    const seq = ++fetchSeqRef.current;

    // Step 1: Load from cache for instant UI
    const cached = await loadFromCache(country);
    if (seq !== fetchSeqRef.current) return;

    // If IndexedDB is empty but a lastSync timestamp exists, the cache was wiped
    // (e.g. after a schema upgrade). Clear the stale timestamp so deltaSync
    // performs a full load instead of a no-op incremental query.
    if (cached.length === 0 && typeof window !== "undefined") {
      const syncKey = lastSyncKey(country);
      if (localStorage.getItem(syncKey)) {
        localStorage.removeItem(syncKey);
        log.warn("[ProductsSync] IndexedDB empty but lastSync was set — clearing stale timestamp for full reload.");
      }
    }

    if (cached.length > 0) {
      setProducts(cached);
      setSearchProducts(indexProducts(cached));
      setLoading(false);
      console.info(`[ProductsSync] Cache: ${cached.length} products loaded from IndexedDB`);
    }

    // Step 2: Delta-sync + purchase history in parallel
    const [synced] = await Promise.all([
      deltaSync(country),
      loadPurchaseHistory(),
    ]);
    if (seq !== fetchSeqRef.current) return;

    if (synced) {
      setProducts(synced);
      setSearchProducts(indexProducts(synced));
    }

    setLoading(false);
  }, [country]);

  useEffect(() => {
    syncProducts();
  }, [syncProducts]);

  const refetch = useCallback(async () => {
    if (country === null) return;
    const seq = ++fetchSeqRef.current;

    const synced = await deltaSync(country);
    if (seq !== fetchSeqRef.current) return;

    if (synced) {
      setProducts(synced);
      setSearchProducts(indexProducts(synced));
    }
  }, [country]);

  const value = useMemo(
    () => ({ products, loading, refetch }),
    [products, loading, refetch],
  );

  return (
    <ProductsContext.Provider value={value}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts(): ProductsContextValue {
  const ctx = useContext(ProductsContext);
  if (!ctx) {
    return { products: [], loading: false, refetch: async () => {} };
  }
  return ctx;
}
