"use client";

import { useEffect, useState, useCallback, useMemo, useRef, type RefCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/auth/auth-context";
import { loadInventory } from "@/lib/inventory/inventory-service";
import type { InventoryItem } from "@/lib/inventory/inventory-types";
import type { Product, CompetitorProduct } from "@/types";
import { getCategoryGroup, SECTION_ICONS, type CategoryGroupKey } from "@/lib/list/recent-purchase-categories";
import { useProducts } from "@/lib/products-context";
import { findCompetitorProductById } from "@/lib/competitor-products/competitor-product-service";
import { ProductCaptureModal } from "@/components/product-capture/product-capture-modal";
import { InventoryEditSheet } from "./inventory-edit-sheet";
import { InventoryItemRow } from "./inventory-item-row";
import { InventoryFilters, type InventoryFilter } from "./inventory-filters";
import { filterExpiredPerishables } from "./inventory-perishable-filter";
import { filterInventoryByName } from "@/lib/inventory/inventory-search";
import { useInventoryActions } from "./use-inventory-actions";
import { CardSkeleton } from "@/components/ui/skeleton";

const GROUP_SORT: Record<CategoryGroupKey, number> = { produce: 0, chilled: 1, frozen: 2, dry: 3 };
const SECTION_LABEL_KEYS: Record<CategoryGroupKey, string> = {
  produce: "sectionProduce",
  chilled: "sectionChilled",
  frozen: "sectionFrozen",
  dry: "sectionDry",
};

export function InventoryList() {
  const t = useTranslations("inventory");
  const router = useRouter();
  const { products } = useProducts();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<InventoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<{ message: string; undoId?: string; prevStatus?: "sealed" | "opened"; addedListItemId?: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [captureProduct, setCaptureProduct] = useState<Product | null>(null);
  const [captureCompetitor, setCaptureCompetitor] = useState<CompetitorProduct | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [showInventoryEdit, setShowInventoryEdit] = useState(false);

  useEffect(() => {
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, []);

  const showToast = useCallback((message: string, undoId?: string, prevStatus?: "sealed" | "opened", addedListItemId?: string) => {
    setToast({ message, undoId, prevStatus, addedListItemId });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const fetchItems = useCallback(async () => {
    const supabase = createClientIfConfigured();
    if (!supabase) { setLoading(false); return; }
    const userId = getCurrentUserId();
    const result = await loadInventory(supabase, userId);
    setItems(result);
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const actions = useInventoryActions({ items, setItems, showToast, fetchItems, t });

  const navigateTo = useCallback((mode: "add" | "consume" | "open") => {
    router.push(`/receipts/inventory-action?mode=${mode}` as never);
  }, [router]);

  const handleItemClick = useCallback(async (item: InventoryItem) => {
    if (item.product_id) {
      const found = products.find((p) => p.product_id === item.product_id) ?? null;
      if (found) { setCaptureProduct(found); return; }
    }
    if (item.competitor_product_id) {
      const found = await findCompetitorProductById(item.competitor_product_id);
      if (found) { setCaptureCompetitor(found); return; }
    }
  }, [products]);

  const handleEditBestBefore = useCallback((item: InventoryItem) => {
    setEditingItem(item);
    setShowInventoryEdit(true);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarObserverRef = useRef<ResizeObserver | null>(null);

  const toolbarRef: RefCallback<HTMLDivElement> = useCallback((node) => {
    toolbarObserverRef.current?.disconnect();
    if (!node) return;
    const update = () => {
      containerRef.current?.style.setProperty(
        "--inv-header-h",
        `${node.offsetHeight}px`,
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    toolbarObserverRef.current = ro;
  }, []);

  useEffect(() => {
    return () => toolbarObserverRef.current?.disconnect();
  }, []);

  const activeItems = useMemo(() => filterExpiredPerishables(items), [items]);
  const openedCount = useMemo(() => activeItems.filter((i) => i.status === "opened").length, [activeItems]);

  const categoryChips = useMemo(() => {
    const counts = new Map<CategoryGroupKey, number>();
    for (const item of activeItems) {
      const group = getCategoryGroup(item.demand_group_code, item.is_frozen);
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => GROUP_SORT[a.code] - GROUP_SORT[b.code]);
  }, [activeItems]);

  const searchedItems = useMemo(
    () => filterInventoryByName(activeItems, searchQuery),
    [activeItems, searchQuery],
  );

  const filteredItems = useMemo(() => {
    if (filter === "all") return searchedItems;
    if (filter === "opened") return searchedItems.filter((i) => i.status === "opened");
    return searchedItems.filter((i) => getCategoryGroup(i.demand_group_code, i.is_frozen) === filter);
  }, [searchedItems, filter]);

  const grouped = useMemo(() => {
    const groups = new Map<CategoryGroupKey, InventoryItem[]>();
    for (const item of filteredItems) {
      const key = getCategoryGroup(item.demand_group_code, item.is_frozen);
      const arr = groups.get(key) ?? [];
      arr.push(item);
      groups.set(key, arr);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => GROUP_SORT[a] - GROUP_SORT[b]);
  }, [filteredItems]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <CardSkeleton /><CardSkeleton /><CardSkeleton />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-aldi-blue-light">
          <svg className="h-8 w-8 text-aldi-blue" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-aldi-muted">{t("empty")}</p>
        <p className="text-center text-xs text-aldi-muted">{t("emptyHint")}</p>
        <button type="button" onClick={() => navigateTo("add")} className="mt-2 rounded-xl bg-aldi-blue px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90">
          + {t("addProduct")}
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col">
      <div ref={toolbarRef} className="sticky top-0 z-10 flex flex-col gap-2 border-b border-aldi-muted-light bg-white px-4 pb-2.5 pt-3">
        <div className="flex gap-2">
          <button type="button" onClick={() => navigateTo("add")} className="flex-1 rounded-xl bg-aldi-blue px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90">
            + {t("addProduct")}
          </button>
          <button type="button" onClick={() => navigateTo("open")} className="flex-1 rounded-xl border border-aldi-orange px-3 py-2 text-xs font-medium text-aldi-orange transition-colors hover:bg-aldi-orange/5">
            {t("openProduct")}
          </button>
          <button type="button" onClick={() => navigateTo("consume")} className="flex-1 rounded-xl border border-red-500 px-3 py-2 text-xs font-medium text-red-500 transition-colors hover:bg-red-50">
            {t("consumeProduct")}
          </button>
        </div>

        <input
          type="search"
          className="w-full rounded-xl border border-aldi-muted-light bg-gray-50 px-3 py-2 text-sm text-aldi-text outline-none placeholder:text-aldi-muted focus:border-aldi-blue focus:ring-1 focus:ring-aldi-blue"
          placeholder={t("searchInventory")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoComplete="off"
        />

        {(openedCount > 0 || categoryChips.length > 1) && (
          <InventoryFilters active={filter} onChange={setFilter} openedCount={openedCount} categoryChips={categoryChips} />
        )}
      </div>

      <div className="flex flex-col gap-3 p-4">
        {filteredItems.length === 0 && searchQuery.trim() && (
          <p className="py-8 text-center text-sm text-aldi-muted">{t("searchNoResults")}</p>
        )}

        {grouped.map(([groupKey, groupItems]) => (
          <div key={groupKey}>
            <div className="sticky top-[var(--inv-header-h,140px)] z-[5] -mx-4 mb-1.5 flex items-center gap-2 border-b border-aldi-muted-light bg-gray-100 px-4 py-1.5">
              <span aria-hidden>{SECTION_ICONS[groupKey]}</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-aldi-muted">{t(SECTION_LABEL_KEYS[groupKey])}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {groupItems.map((item) => (
                <InventoryItemRow
                  key={item.id}
                  item={item}
                  onConsume={actions.handleConsume}
                  onConsumeAndAddToList={actions.handleConsumeAndAddToList}
                  onOpen={actions.handleOpen}
                  onSeal={actions.handleSeal}
                  onFreeze={actions.handleFreeze}
                  onThaw={actions.handleThaw}
                  onQuantityChange={actions.handleQuantityChange}
                  onDelete={actions.handleDelete}
                  onItemClick={handleItemClick}
                  onEditBestBefore={handleEditBestBefore}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-4 right-4 z-40 mx-auto max-w-sm animate-fade-in rounded-xl bg-aldi-text px-4 py-3 text-center text-sm text-white shadow-lg">
          {toast.message}
          {toast.undoId && toast.prevStatus && (
            <button type="button" onClick={() => { actions.handleUndo(toast.undoId!, toast.prevStatus!, toast.addedListItemId); setToast(null); }} className="ml-2 font-semibold text-aldi-orange underline">
              {t("consumedUndo")}
            </button>
          )}
        </div>
      )}

      <ProductCaptureModal
        open={!!captureProduct}
        mode="edit"
        onClose={() => setCaptureProduct(null)}
        onSaved={() => { setCaptureProduct(null); fetchItems(); }}
        editAldiProduct={captureProduct}
        hiddenFields={["retailer"]}
      />
      <ProductCaptureModal
        open={!!captureCompetitor}
        mode="edit"
        onClose={() => setCaptureCompetitor(null)}
        onSaved={() => { setCaptureCompetitor(null); fetchItems(); }}
        editCompetitorProduct={captureCompetitor}
      />
      {showInventoryEdit && (
        <InventoryEditSheet
          item={editingItem}
          onClose={() => { setShowInventoryEdit(false); setEditingItem(null); }}
          onSaved={() => { fetchItems(); showToast(t("bestBeforeSaved")); }}
        />
      )}
    </div>
  );
}
