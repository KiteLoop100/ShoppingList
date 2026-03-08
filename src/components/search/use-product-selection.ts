"use client";

import { useState, useCallback, useEffect, useMemo } from "react";

export interface ProductSelectionItem {
  product_id: string;
}

export interface UseProductSelectionOptions {
  items: ProductSelectionItem[];
  /** Whether items start pre-selected (e.g. recent purchases) or unselected (e.g. specials). */
  initiallySelected: boolean;
}

export interface ProductSelectionState {
  effectiveSelected: boolean[];
  effectiveQuantities: number[];
  selectedCount: number;
  selectedItems: { product_id: string; quantity: number }[];
  allSelected: boolean;
  toggle: (index: number) => void;
  changeQuantity: (index: number, delta: number) => void;
  selectAll: () => void;
  deselectAll: () => void;
}

export function useProductSelection({
  items,
  initiallySelected,
}: UseProductSelectionOptions): ProductSelectionState {
  const [selected, setSelected] = useState<boolean[]>([]);
  const [quantities, setQuantities] = useState<number[]>([]);

  useEffect(() => {
    if (items.length > 0) {
      setSelected(items.map(() => initiallySelected));
      setQuantities(items.map(() => 1));
    }
  }, [items, initiallySelected]);

  const toggle = useCallback((index: number) => {
    setSelected((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, []);

  const changeQuantity = useCallback((index: number, delta: number) => {
    setQuantities((prev) => {
      const next = [...prev];
      next[index] = Math.max(1, (next[index] ?? 1) + delta);
      return next;
    });
    setSelected((prev) => {
      const next = [...prev];
      next[index] = true;
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(items.map(() => true));
  }, [items]);

  const deselectAll = useCallback(() => {
    setSelected(items.map(() => false));
  }, [items]);

  const effectiveSelected = useMemo(
    () => (selected.length === items.length ? selected : items.map(() => initiallySelected)),
    [selected, items, initiallySelected],
  );

  const effectiveQuantities = useMemo(
    () => (quantities.length === items.length ? quantities : items.map(() => 1)),
    [quantities, items],
  );

  const selectedCount = useMemo(
    () => effectiveSelected.filter(Boolean).length,
    [effectiveSelected],
  );

  const allSelected = useMemo(
    () => effectiveSelected.length > 0 && effectiveSelected.every(Boolean),
    [effectiveSelected],
  );

  const selectedItems = useMemo(
    () =>
      items
        .map((item, i) => ({
          product_id: item.product_id,
          quantity: effectiveQuantities[i],
          selected: effectiveSelected[i],
        }))
        .filter((x) => x.selected)
        .map(({ product_id, quantity }) => ({ product_id, quantity })),
    [items, effectiveQuantities, effectiveSelected],
  );

  return { effectiveSelected, effectiveQuantities, selectedCount, selectedItems, allSelected, toggle, changeQuantity, selectAll, deselectAll };
}
