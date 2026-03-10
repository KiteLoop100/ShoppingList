"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/auth/auth-context";
import {
  loadInventory,
  consumeInventoryItem,
  openInventoryItem,
  updateQuantity,
  removeInventoryItem,
  unconsume,
} from "@/lib/inventory/inventory-service";
import type { InventoryItem } from "@/lib/inventory/inventory-types";
import { getCategoryGroup, SECTION_ICONS, type CategoryGroupKey } from "@/lib/list/recent-purchase-categories";
import { InventoryItemRow } from "./inventory-item-row";
import { InventoryFilters, type InventoryFilter } from "./inventory-filters";
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
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<InventoryFilter>("all");
  const [toast, setToast] = useState<{ message: string; undoId?: string; prevStatus?: "sealed" | "opened" } | null>(null);
  const toastTimerRef = useState<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, undoId?: string, prevStatus?: "sealed" | "opened") => {
    setToast({ message, undoId, prevStatus });
    if (toastTimerRef[0]) clearTimeout(toastTimerRef[0]);
    toastTimerRef[0] = setTimeout(() => setToast(null), 5000);
  }, [toastTimerRef]);

  const fetchItems = useCallback(async () => {
    const supabase = createClientIfConfigured();
    if (!supabase) { setLoading(false); return; }

    const userId = getCurrentUserId();
    const result = await loadInventory(supabase, userId);
    setItems(result);
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleConsume = useCallback(async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const supabase = createClientIfConfigured();
    if (!supabase) return;

    const prevStatus = item.status as "sealed" | "opened";
    setItems((prev) => prev.filter((i) => i.id !== id));

    const ok = await consumeInventoryItem(supabase, id);
    if (ok) {
      showToast(t("consumedToast", { name: item.display_name }), id, prevStatus);
    } else {
      setItems((prev) => [...prev, item]);
    }
  }, [items, t, showToast]);

  const handleUndo = useCallback(async (itemId: string, prevStatus: "sealed" | "opened") => {
    const supabase = createClientIfConfigured();
    if (!supabase) return;

    const ok = await unconsume(supabase, itemId, prevStatus);
    if (ok) {
      setToast(null);
      fetchItems();
    }
  }, [fetchItems]);

  const handleOpen = useCallback(async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const supabase = createClientIfConfigured();
    if (!supabase) return;

    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: "opened" as const, opened_at: new Date().toISOString() } : i));
    const ok = await openInventoryItem(supabase, id);
    if (ok) {
      showToast(t("openedToast", { name: item.display_name }));
    } else {
      fetchItems();
    }
  }, [items, t, showToast, fetchItems]);

  const handleQuantityChange = useCallback(async (id: string, qty: number) => {
    const supabase = createClientIfConfigured();
    if (!supabase) return;

    setItems((prev) => prev.map((i) => i.id === id ? { ...i, quantity: qty } : i));
    await updateQuantity(supabase, id, qty);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    const supabase = createClientIfConfigured();
    if (!supabase) return;

    setItems((prev) => prev.filter((i) => i.id !== id));
    await removeInventoryItem(supabase, id);
  }, []);

  const openedCount = useMemo(
    () => items.filter((i) => i.status === "opened").length,
    [items],
  );

  const categoryChips = useMemo(() => {
    const counts = new Map<CategoryGroupKey, number>();
    for (const item of items) {
      const group = getCategoryGroup(item.demand_group_code);
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => GROUP_SORT[a.code] - GROUP_SORT[b.code]);
  }, [items]);

  const filteredItems = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "opened") return items.filter((i) => i.status === "opened");
    return items.filter((i) => getCategoryGroup(i.demand_group_code) === filter);
  }, [items, filter]);

  const grouped = useMemo(() => {
    const groups = new Map<CategoryGroupKey, InventoryItem[]>();
    for (const item of filteredItems) {
      const key = getCategoryGroup(item.demand_group_code);
      const arr = groups.get(key) ?? [];
      arr.push(item);
      groups.set(key, arr);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => GROUP_SORT[a] - GROUP_SORT[b]);
  }, [filteredItems]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
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
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {(openedCount > 0 || categoryChips.length > 1) && (
        <InventoryFilters
          active={filter}
          onChange={setFilter}
          openedCount={openedCount}
          categoryChips={categoryChips}
        />
      )}

      {grouped.map(([groupKey, groupItems]) => (
        <div key={groupKey}>
          <div className="sticky top-0 z-[2] -mx-4 mb-1.5 flex items-center gap-2 border-b border-aldi-muted-light bg-gray-100 px-4 py-1.5">
            <span aria-hidden>{SECTION_ICONS[groupKey]}</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-aldi-muted">
              {t(SECTION_LABEL_KEYS[groupKey])}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {groupItems.map((item) => (
              <InventoryItemRow
                key={item.id}
                item={item}
                onConsume={handleConsume}
                onOpen={handleOpen}
                onQuantityChange={handleQuantityChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      ))}

      {toast && (
        <div className="fixed bottom-6 left-4 right-4 z-40 mx-auto max-w-sm animate-fade-in rounded-xl bg-aldi-text px-4 py-3 text-center text-sm text-white shadow-lg">
          {toast.message}
          {toast.undoId && toast.prevStatus && (
            <button
              type="button"
              onClick={() => handleUndo(toast.undoId!, toast.prevStatus!)}
              className="ml-2 font-semibold text-aldi-orange underline"
            >
              {t("consumedUndo")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
