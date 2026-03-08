"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { ProductTile } from "@/components/catalog/product-tile";
import type { Product } from "@/types";
import type { ListItemWithMeta } from "@/lib/list/list-helpers";

interface ShoppingTileGridProps {
  items: ListItemWithMeta[];
  products: Product[];
  onCheck: (itemId: string, checked: boolean) => void;
  onDelete?: (itemId: string) => void;
  onDefer?: (itemId: string) => void;
  onBuyElsewhere?: (itemId: string) => void;
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

const EXIT_ANIMATION_MS = 300;

export function ShoppingTileGrid({
  items,
  products,
  onCheck,
  onDelete,
  onDefer,
  onBuyElsewhere,
}: ShoppingTileGridProps) {
  const productMap = useMemo(
    () => new Map(products.map((p) => [p.product_id, p])),
    [products],
  );
  const itemMap = useMemo(
    () => new Map(items.map((i) => [i.item_id, i])),
    [items],
  );

  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const exitTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const handleCheck = useCallback(
    (itemId: string) => {
      setExitingIds((prev) => new Set([...prev, itemId]));

      const timer = setTimeout(() => {
        exitTimers.current.delete(itemId);
        setExitingIds((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
        onCheck(itemId, true);
      }, EXIT_ANIMATION_MS);

      exitTimers.current.set(itemId, timer);
    },
    [onCheck],
  );

  const visibleItems = items.filter(
    (i) => !exitingIds.has(i.item_id) || exitingIds.has(i.item_id),
  );

  if (visibleItems.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {visibleItems.map((item) => {
        const isExiting = exitingIds.has(item.item_id);
        const tileProduct = toTileProduct(item, productMap);

        return (
          <div
            key={item.item_id}
            className={isExiting ? "animate-tile-exit" : "animate-tile-enter"}
          >
            <ProductTile
              product={tileProduct}
              shoppingListMode={{
                checked: false,
                onCheck: () => handleCheck(item.item_id),
                quantity: item.quantity,
                onDefer: onDefer ? () => onDefer(item.item_id) : undefined,
                onBuyElsewhere: onBuyElsewhere
                  ? () => onBuyElsewhere(item.item_id)
                  : undefined,
                onDelete: onDelete ? () => onDelete(item.item_id) : undefined,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
