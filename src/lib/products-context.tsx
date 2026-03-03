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
import { createClientIfConfigured } from "@/lib/supabase/client";
import { useCurrentCountry } from "@/lib/current-country-context";
import { log } from "@/lib/utils/logger";
import { setSearchProducts } from "@/lib/search/local-search";
import { indexProducts } from "@/lib/search/search-indexer";

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    product_id: String(row.product_id),
    article_number: row.article_number != null ? String(row.article_number) : null,
    ean_barcode: row.ean_barcode != null ? String(row.ean_barcode) : null,
    name: String(row.name),
    name_normalized: String(row.name_normalized),
    brand: row.brand != null ? String(row.brand) : null,
    demand_group: row.demand_group != null ? String(row.demand_group) : null,
    demand_sub_group: row.demand_sub_group != null ? String(row.demand_sub_group) : null,
    demand_group_code: row.demand_group_code != null ? String(row.demand_group_code) : (row.category_id != null ? String(row.category_id) : "AK"),
    category_id: row.category_id != null ? String(row.category_id) : undefined,
    price: row.price != null ? Number(row.price) : null,
    price_updated_at: row.price_updated_at != null ? String(row.price_updated_at) : null,
    popularity_score: row.popularity_score != null ? Number(row.popularity_score) : null,
    assortment_type: (row.assortment_type as Product["assortment_type"]) ?? "daily_range",
    availability: (row.availability as Product["availability"]) ?? "national",
    region: row.region != null ? String(row.region) : null,
    country: row.country != null ? String(row.country) : "DE",
    special_start_date: row.special_start_date != null ? String(row.special_start_date) : null,
    special_end_date: row.special_end_date != null ? String(row.special_end_date) : null,
    status: (row.status as Product["status"]) ?? "active",
    source: (row.source as Product["source"]) ?? "admin",
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    thumbnail_url: row.thumbnail_url != null ? String(row.thumbnail_url) : null,
    thumbnail_back_url: row.thumbnail_back_url != null ? String(row.thumbnail_back_url) : null,
    photo_source_id: row.photo_source_id != null ? String(row.photo_source_id) : null,
    nutrition_info: row.nutrition_info != null ? (row.nutrition_info as Product["nutrition_info"]) : null,
    ingredients: row.ingredients != null ? String(row.ingredients) : null,
    allergens: row.allergens != null ? String(row.allergens) : null,
    weight_or_quantity: row.weight_or_quantity != null ? String(row.weight_or_quantity) : null,
  };
}

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
): Promise<{ rows: Record<string, unknown>[]; error: boolean }> {
  const supabase = createClientIfConfigured();
  if (!supabase) return { rows: [], error: true };

  const allRows: Record<string, unknown>[] = [];
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
    const rows = data ?? [];
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

  const products = rows.map(rowToProduct);

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

    if (cached.length > 0) {
      setProducts(cached);
      setSearchProducts(indexProducts(cached));
      setLoading(false);
      console.info(`[ProductsSync] Cache: ${cached.length} products loaded from IndexedDB`);
    }

    // Step 2: Delta-sync in background
    const synced = await deltaSync(country);
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
