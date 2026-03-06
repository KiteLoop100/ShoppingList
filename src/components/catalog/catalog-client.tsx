"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { useProducts } from "@/lib/products-context";
import {
  fetchDemandGroupsFromSupabase,
  getMetaCategories,
  getChildGroups,
  getChildGroupCodes,
  type DemandGroupRow,
} from "@/lib/categories/category-service";
import { indexProducts } from "@/lib/search/search-indexer";
import { scoreForCatalog } from "@/lib/search/scoring-engine";
import { getUserHistory } from "@/lib/search/local-search";
import { getProductPreferences } from "@/lib/settings/product-preferences";
import { applySmartFilter } from "@/lib/catalog/smart-filter";
import { getReceiptCount } from "@/lib/list/last-trip";
import { CategoryBar } from "./category-bar";
import { SubcategoryNav } from "./subcategory-nav";
import { ProductGrid } from "./product-grid";
import { useBreakpoint } from "@/hooks/use-breakpoint";

function SmartFilterButton({
  enabled,
  label,
  onToggle,
}: {
  enabled: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
        enabled
          ? "bg-aldi-blue text-white shadow-sm"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
      aria-pressed={enabled}
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
      </svg>
      {label}
    </button>
  );
}

export function CatalogClient() {
  const t = useTranslations("catalog");
  const tCommon = useTranslations("common");
  const bp = useBreakpoint();
  const { products, loading: productsLoading } = useProducts();

  const [allGroups, setAllGroups] = useState<DemandGroupRow[]>([]);
  const [selectedMeta, setSelectedMeta] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [smartFilterEnabled, setSmartFilterEnabled] = useState(false);
  const [receiptCount, setReceiptCount] = useState(0);

  useEffect(() => {
    getReceiptCount().then(setReceiptCount);
  }, []);

  useEffect(() => {
    fetchDemandGroupsFromSupabase().then((rows) => {
      if (rows) {
        setAllGroups(rows);
        const metas = rows.filter(
          (r) => r.parent_group === null && r.code.startsWith("M"),
        );
        if (metas.length > 0 && !selectedMeta) {
          setSelectedMeta(metas[0].code);
        }
      }
      setGroupsLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const metaCategories = useMemo(
    () => getMetaCategories(allGroups),
    [allGroups],
  );

  const childGroups = useMemo(
    () => (selectedMeta ? getChildGroups(allGroups, selectedMeta) : []),
    [allGroups, selectedMeta],
  );

  const activeGroupCodes = useMemo(() => {
    if (!selectedMeta) return new Set<string>();
    if (selectedGroup) return new Set([selectedGroup]);
    return new Set(getChildGroupCodes(allGroups, selectedMeta));
  }, [allGroups, selectedMeta, selectedGroup]);

  const indexedProducts = useMemo(
    () => indexProducts(products),
    [products],
  );

  const preferences = useMemo(() => getProductPreferences(), []);

  const userHistory = useMemo(() => getUserHistory(), []);

  const scoredProducts = useMemo(() => {
    if (activeGroupCodes.size === 0) return [];

    const filtered = indexedProducts.filter(
      (p) =>
        p.assortment_type === "daily_range" &&
        activeGroupCodes.has(p.demand_group_code),
    );

    return scoreForCatalog(filtered, preferences, userHistory);
  }, [indexedProducts, activeGroupCodes, preferences, userHistory]);

  const displayProducts = useMemo(
    () =>
      smartFilterEnabled
        ? applySmartFilter(scoredProducts, userHistory, receiptCount)
        : scoredProducts,
    [scoredProducts, smartFilterEnabled, userHistory, receiptCount],
  );

  const handleMetaSelect = useCallback(
    (code: string) => {
      setSelectedMeta(code);
      setSelectedGroup(null);
    },
    [],
  );

  const handleGroupSelect = useCallback(
    (code: string | null) => {
      setSelectedGroup(code);
    },
    [],
  );

  if (groupsLoading || productsLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-gray-400">
        {t("loadingCategories")}
      </div>
    );
  }

  const isMobile = bp !== "desktop";

  return (
    <main className="mx-auto flex h-screen max-w-5xl flex-col overflow-hidden bg-aldi-bg lg:h-[calc(100vh-49px)]">
      <header className="flex shrink-0 items-center gap-2 bg-white px-2 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)] lg:hidden">
        <Link
          href="/"
          className="touch-target flex items-center justify-center rounded-xl text-aldi-blue transition-colors hover:bg-aldi-blue-light"
          aria-label={tCommon("back")}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="flex-1 text-[17px] font-semibold leading-tight tracking-tight text-aldi-text">
          {t("title")}
        </h1>
        <SmartFilterButton
          enabled={smartFilterEnabled}
          label={t(smartFilterEnabled ? "smartFilterActive" : "smartFilter")}
          onToggle={() => setSmartFilterEnabled((v) => !v)}
        />
      </header>

      <div className="flex shrink-0 items-stretch border-b border-aldi-muted-light bg-white">
        <div className="min-w-0 flex-1">
          <CategoryBar
            categories={metaCategories}
            selected={selectedMeta}
            onSelect={handleMetaSelect}
          />
        </div>
        <div className="hidden items-center border-l border-aldi-muted-light px-3 lg:flex">
          <SmartFilterButton
            enabled={smartFilterEnabled}
            label={t(smartFilterEnabled ? "smartFilterActive" : "smartFilter")}
            onToggle={() => setSmartFilterEnabled((v) => !v)}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {!isMobile && childGroups.length > 1 && (
          <SubcategoryNav
            groups={childGroups}
            selected={selectedGroup}
            onSelect={handleGroupSelect}
            variant="sidebar"
          />
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {isMobile && childGroups.length > 1 && (
            <SubcategoryNav
              groups={childGroups}
              selected={selectedGroup}
              onSelect={handleGroupSelect}
              variant="chips"
            />
          )}

          <ProductGrid products={displayProducts} />
        </div>
      </div>
    </main>
  );
}
