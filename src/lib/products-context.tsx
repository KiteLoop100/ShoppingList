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
    category_id: String(row.category_id),
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

  const fetchProducts = useCallback(async () => {
    if (country === null) {
      return;
    }
    const seq = ++fetchSeqRef.current;
    const supabase = createClientIfConfigured();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const allRows: Record<string, unknown>[] = [];
    const PAGE_SIZE = 1000;
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("status", "active")
        .eq("country", country)
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        log.error("[ProductsProvider] Supabase products fetch failed:", error.message);
        if (seq === fetchSeqRef.current) setLoading(false);
        return;
      }
      if (seq !== fetchSeqRef.current) return;
      const rows = data ?? [];
      allRows.push(...rows);
      hasMore = rows.length === PAGE_SIZE;
      from += PAGE_SIZE;
    }
    if (seq !== fetchSeqRef.current) return;
    try {
      const list = allRows.map(rowToProduct);
      setProducts(list);
      setSearchProducts(indexProducts(list));
      if (typeof window !== "undefined" && list.length > 0) {
        console.info("[ProductsProvider]", list.length, "Produkte (country=" + country + ") aus Supabase geladen.");
      }
    } catch (err) {
      log.error("[ProductsProvider] rowToProduct mapping failed:", err);
      setProducts([]);
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [country]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const value = useMemo(
    () => ({
      products,
      loading,
      refetch: fetchProducts,
    }),
    [products, loading, fetchProducts]
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
