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
import type { CompetitorProduct } from "@/types";
import { useCurrentCountry } from "@/lib/current-country-context";
import { fetchCompetitorProducts } from "./competitor-product-service";
import { db } from "@/lib/db";
import { log } from "@/lib/utils/logger";

interface CompetitorProductsContextValue {
  products: CompetitorProduct[];
  loading: boolean;
  refetch: () => Promise<void>;
}

const CompetitorProductsContext = createContext<CompetitorProductsContextValue | null>(null);

export function CompetitorProductsProvider({ children }: { children: ReactNode }) {
  const { country } = useCurrentCountry();
  const [products, setProducts] = useState<CompetitorProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchSeqRef = useRef(0);

  const fetchProducts = useCallback(async () => {
    if (country === null) return;
    const seq = ++fetchSeqRef.current;
    try {
      const list = await fetchCompetitorProducts(country);
      if (seq !== fetchSeqRef.current) return;
      setProducts(list);

      try {
        await db.competitor_products.clear();
        if (list.length > 0) {
          await db.competitor_products.bulkAdd(list as never[]);
        }
      } catch (idbErr) {
        log.error("[CompetitorProductsProvider] IndexedDB sync failed:", idbErr);
      }

      if (typeof window !== "undefined" && list.length > 0) {
        console.info(
          "[CompetitorProductsProvider]",
          list.length,
          "competitor products (country=" + country + ") loaded."
        );
      }
    } catch (err) {
      log.error("[CompetitorProductsProvider] fetch failed:", err);
      if (seq !== fetchSeqRef.current) return;

      try {
        const cached = await db.competitor_products
          .where("country")
          .equals(country)
          .toArray();
        if (cached.length > 0) setProducts(cached);
      } catch {
        /* IndexedDB also unavailable */
      }
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [country]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const value = useMemo(
    () => ({ products, loading, refetch: fetchProducts }),
    [products, loading, fetchProducts]
  );

  return (
    <CompetitorProductsContext.Provider value={value}>
      {children}
    </CompetitorProductsContext.Provider>
  );
}

export function useCompetitorProducts(): CompetitorProductsContextValue {
  const ctx = useContext(CompetitorProductsContext);
  if (!ctx) {
    return { products: [], loading: false, refetch: async () => {} };
  }
  return ctx;
}
