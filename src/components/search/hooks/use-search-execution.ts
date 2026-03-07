"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { log } from "@/lib/utils/logger";
import {
  searchModule, isLastTripCommand, isAktionsartikelCommand,
  detectRetailerPrefix, type RetailerPrefixResult,
} from "@/lib/search";
import { getRecentListProducts, type RecentListProduct } from "@/lib/list";
import { searchRetailerProducts, type RetailerProductResult } from "@/lib/competitor-products/competitor-product-service";
import type { Product, SearchResult } from "@/types";

const SEARCH_DEBOUNCE_MS = 150;
export const MIN_QUERY_LENGTH = 1;

type ProductSpecialFields = {
  assortment_type?: string;
  special_start_date?: string | null;
  special_end_date?: string | null;
};

export interface UseSearchExecutionOptions {
  query: string;
  products: Product[];
  country: string | null;
}

export function useSearchExecution({ query, products, country }: UseSearchExecutionOptions) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentListProducts, setRecentListProducts] = useState<RecentListProduct[] | null | "pending">(null);
  const [specialsProducts, setSpecialsProducts] = useState<Product[] | null | "pending">(null);
  const [retailerProducts, setRetailerProducts] = useState<RetailerProductResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchIdRef = useRef(0);
  const productsRef = useRef(products);
  productsRef.current = products;
  const countryRef = useRef(country);
  countryRef.current = country;

  const trimmedQuery = useMemo(() => query.trim(), [query]);
  const isRecentCommand = useMemo(
    () => trimmedQuery.length >= MIN_QUERY_LENGTH && isLastTripCommand(trimmedQuery),
    [trimmedQuery],
  );
  const isSpecialsCommand = useMemo(
    () => trimmedQuery.length >= MIN_QUERY_LENGTH && isAktionsartikelCommand(trimmedQuery),
    [trimmedQuery],
  );
  const retailerPrefix = useMemo(
    (): RetailerPrefixResult | null =>
      trimmedQuery.length >= MIN_QUERY_LENGTH
        ? detectRetailerPrefix(trimmedQuery, country ?? "DE")
        : null,
    [trimmedQuery, country],
  );

  const resetResults = useCallback(() => {
    setResults([]);
    setRecentListProducts(null);
    setSpecialsProducts(null);
    setRetailerProducts([]);
  }, []);

  const runSearch = useCallback(async (q: string, id: number) => {
    const trimmed = q.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) { setResults([]); return; }
    setIsSearching(true);
    try {
      const currentProducts = productsRef.current;
      if (currentProducts.length > 0) {
        const list = await searchModule({ query: trimmed, limit: 50, products: currentProducts });
        if (id !== searchIdRef.current) return;
        setResults(list);
        return;
      }
      const countryCode = countryRef.current ?? "DE";
      const res = await fetch(
        `/api/products/search?q=${encodeURIComponent(trimmed)}&country=${encodeURIComponent(countryCode)}&limit=20`,
      );
      if (id !== searchIdRef.current) return;
      if (!res.ok) { setResults([]); return; }
      type ApiProduct = { product_id: string; name: string; demand_group_code: string; demand_group_name: string; price: number | null; thumbnail_url?: string | null };
      const json = (await res.json()) as { products?: ApiProduct[] };
      const list: SearchResult[] = (json.products ?? []).map((p) => ({
        product_id: p.product_id, name: p.name,
        demand_group_code: p.demand_group_code,
        demand_group_name: p.demand_group_name ?? "",
        price: p.price, score: 1, source: "other" as const,
        thumbnail_url: p.thumbnail_url ?? null,
      }));
      if (id !== searchIdRef.current) return;
      setResults(list);
    } finally {
      if (id === searchIdRef.current) setIsSearching(false);
    }
  }, []);

  const fetchRecentPurchases = useCallback(async () => {
    setIsSearching(true);
    setRecentListProducts("pending");
    try {
      setRecentListProducts(await getRecentListProducts());
    } finally {
      setIsSearching(false);
    }
  }, []);

  const fetchSpecials = useCallback(() => {
    setIsSearching(true);
    setSpecialsProducts("pending");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fourWeeksAgo = new Date(today);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const specials = productsRef.current
      .filter((p) => {
        if (p.status !== "active") return false;
        const sp = p as Product & ProductSpecialFields;
        const at = sp.assortment_type;
        if (at !== "special" && at !== "special_food" && at !== "special_nonfood") return false;
        if (sp.special_start_date && new Date(sp.special_start_date) < fourWeeksAgo) return false;
        if (sp.special_end_date && new Date(sp.special_end_date) < today) return false;
        return true;
      })
      .sort((a, b) => {
        const aD = (a as Product & ProductSpecialFields).special_start_date ?? "";
        const bD = (b as Product & ProductSpecialFields).special_start_date ?? "";
        return bD.localeCompare(aD);
      })
      .slice(0, 100);
    setSpecialsProducts(specials);
    setIsSearching(false);
  }, []);

  const runRetailerSearch = useCallback(
    async (retailerName: string, productQuery: string, id: number) => {
      setIsSearching(true);
      try {
        const countryCode = countryRef.current ?? "DE";
        const list = await searchRetailerProducts(retailerName, countryCode, productQuery || undefined);
        if (id !== searchIdRef.current) return;
        setRetailerProducts(list);
      } catch (e) {
        log.error("[runRetailerSearch] failed:", e);
        if (id === searchIdRef.current) setRetailerProducts([]);
      } finally {
        if (id === searchIdRef.current) setIsSearching(false);
      }
    },
    [],
  );

  useEffect(() => {
    const id = ++searchIdRef.current;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (isRecentCommand) {
        setResults([]); setSpecialsProducts(null); setRetailerProducts([]);
        fetchRecentPurchases();
      } else if (isSpecialsCommand) {
        setResults([]); setRecentListProducts(null); setRetailerProducts([]);
        fetchSpecials();
      } else if (retailerPrefix) {
        setRecentListProducts(null); setSpecialsProducts(null); setResults([]);
        runRetailerSearch(retailerPrefix.retailer.name, retailerPrefix.productQuery, id);
      } else {
        setRecentListProducts(null); setSpecialsProducts(null); setRetailerProducts([]);
        runSearch(query, id);
      }
      debounceRef.current = null;
    }, SEARCH_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, isRecentCommand, isSpecialsCommand, retailerPrefix, runSearch, runRetailerSearch, fetchRecentPurchases, fetchSpecials]);

  return {
    results, recentListProducts, specialsProducts, retailerProducts,
    isSearching, isRecentCommand, isSpecialsCommand, retailerPrefix,
    trimmedQuery, resetResults,
  };
}
