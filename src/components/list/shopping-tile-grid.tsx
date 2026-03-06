"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ProductTile } from "@/components/catalog/product-tile";
import type { Product } from "@/types";
import type { ListItemWithMeta } from "@/lib/list/list-helpers";

interface ShoppingTileGridProps {
  items: ListItemWithMeta[];
  products: Product[];
  onCheck: (itemId: string, checked: boolean) => void;
}

function toTileProduct(
  item: ListItemWithMeta,
  productMap: Map<string, Product>,
): Product {
  const linked = item.product_id ? productMap.get(item.product_id) : null;
  if (linked) return linked;
  return {
    product_id: item.item_id,
    name: item.display_name || item.custom_name || "?",
    name_normalized: (item.display_name || item.custom_name || "").toLowerCase(),
    brand: null,
    demand_group_code: item.demand_group_code,
    price: item.price,
    price_updated_at: null,
    assortment_type: "daily_range",
    availability: "national",
    region: null,
    country: "DE",
    special_start_date: null,
    special_end_date: null,
    status: "active",
    source: "admin",
    created_at: item.added_at,
    updated_at: item.added_at,
    thumbnail_url: item.thumbnail_url,
  };
}

/** Groups a flat array into pairs (rows of 2). */
function toRows(ids: string[]): string[][] {
  const rows: string[][] = [];
  for (let i = 0; i < ids.length; i += 2) {
    rows.push(ids.slice(i, Math.min(i + 2, ids.length)));
  }
  return rows;
}

const ROW_COLLAPSE_DELAY_MS = 400;

export function ShoppingTileGrid({ items, products, onCheck }: ShoppingTileGridProps) {
  const productMap = useMemo(
    () => new Map(products.map((p) => [p.product_id, p])),
    [products],
  );
  const itemMap = useMemo(
    () => new Map(items.map((i) => [i.item_id, i])),
    [items],
  );

  // Stable layout: item IDs in their fixed grid positions
  const [stableOrder, setStableOrder] = useState<string[]>([]);
  // Items checked within the tile view (rendered as empty placeholders)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rebuild stableOrder when new items appear (but not when items are removed by checking)
  useEffect(() => {
    const currentItemIds = new Set(items.map((i) => i.item_id));
    setStableOrder((prev) => {
      if (prev.length === 0) return items.map((i) => i.item_id);
      const hasNewItems = items.some(
        (i) => !prev.includes(i.item_id) && !checkedIds.has(i.item_id),
      );
      if (!hasNewItems) return prev;
      const existingSet = new Set(prev);
      const merged = [
        ...prev.filter((id) => currentItemIds.has(id) || checkedIds.has(id)),
      ];
      for (const item of items) {
        if (!existingSet.has(item.item_id)) merged.push(item.item_id);
      }
      return merged;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, []);

  // Schedule row collapse when full rows are detected
  useEffect(() => {
    const rows = toRows(stableOrder);
    const hasFullRow = rows.some((row) => row.every((id) => checkedIds.has(id)));
    if (!hasFullRow) return;

    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = setTimeout(() => {
      collapseTimerRef.current = null;
      const rowsNow = toRows(stableOrder);
      const fullRowIds = new Set(
        rowsNow.filter((r) => r.every((id) => checkedIds.has(id))).flat(),
      );
      if (fullRowIds.size === 0) return;

      setStableOrder((prev) => prev.filter((id) => !fullRowIds.has(id)));
      setCheckedIds((prev) => {
        const next = new Set(prev);
        fullRowIds.forEach((id) => next.delete(id));
        return next;
      });
    }, ROW_COLLAPSE_DELAY_MS);

    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, [checkedIds, stableOrder]);

  const handleCheck = useCallback(
    (itemId: string) => {
      setCheckedIds((prev) => new Set([...prev, itemId]));
      onCheck(itemId, true);
    },
    [onCheck],
  );

  const rows = toRows(stableOrder);
  const visibleRows = rows.filter(
    (row) => !row.every((id) => checkedIds.has(id)),
  );

  if (visibleRows.length === 0) return null;

  return (
    <div className="space-y-2">
      {visibleRows.map((row) => (
        <div key={row.join("-")} className="grid grid-cols-2 gap-2">
          {row.map((itemId) => {
            if (checkedIds.has(itemId)) {
              return <div key={itemId} className="aspect-square" />;
            }
            const item = itemMap.get(itemId);
            if (!item) {
              return <div key={itemId} className="aspect-square" />;
            }
            const tileProduct = toTileProduct(item, productMap);
            return (
              <ProductTile
                key={itemId}
                product={tileProduct}
                shoppingListMode={{
                  checked: false,
                  onCheck: () => handleCheck(itemId),
                  quantity: item.quantity,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
