"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import type { Product } from "@/types";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { useCurrentCountry } from "@/lib/current-country-context";

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
    crowdsource_status: row.crowdsource_status != null ? (row.crowdsource_status as Product["crowdsource_status"]) : null,
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
}

const ProductsContext = createContext<ProductsContextValue | null>(null);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const { country } = useCurrentCountry();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (country === null) {
      setLoading(true);
      setProducts([]);
      return;
    }
    let cancelled = false;
    const supabase = createClientIfConfigured();
    if (!supabase) {
      setLoading(false);
      if (typeof window !== "undefined") {
        console.warn("[ProductsProvider] Supabase nicht konfiguriert (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY fehlen?). Suche nutzt IndexedDB.");
      }
      return;
    }
    setLoading(true);
    supabase
      .from("products")
      .select("*")
      .eq("status", "active")
      .eq("country", country)
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error) {
          console.error("[ProductsProvider] Supabase products fetch failed:", error.message);
          return;
        }
        const list = (data ?? []).map(rowToProduct);
        setProducts(list);
        if (typeof window !== "undefined" && list.length > 0) {
          console.info("[ProductsProvider]", list.length, "Produkte (country=" + country + ") aus Supabase geladen.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [country]);

  const value = useMemo(
    () => ({ products, loading }),
    [products, loading]
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
    return { products: [], loading: false };
  }
  return ctx;
}
