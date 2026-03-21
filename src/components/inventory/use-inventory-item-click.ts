"use client";

import { useCallback } from "react";
import type { InventoryItem } from "@/lib/inventory/inventory-types";
import type { Product, CompetitorProduct } from "@/types";
import { findAldiProductForInventoryItem } from "@/lib/inventory/inventory-product-tap";
import { findCompetitorProductById } from "@/lib/competitor-products/competitor-product-service";

interface UseInventoryItemClickParams {
  products: Product[];
  setDetailProduct: (p: Product | null) => void;
  setDetailCompetitor: (p: CompetitorProduct | null) => void;
}

export function useInventoryItemClick({
  products,
  setDetailProduct,
  setDetailCompetitor,
}: UseInventoryItemClickParams) {
  const handleItemClick = useCallback(
    async (item: InventoryItem) => {
      if (item.product_id) {
        const found = findAldiProductForInventoryItem(item, products);
        if (found) {
          setDetailProduct(found);
          return;
        }
      }
      if (item.competitor_product_id) {
        const found = await findCompetitorProductById(item.competitor_product_id);
        if (found) {
          setDetailCompetitor(found);
        }
      }
    },
    [products, setDetailProduct, setDetailCompetitor],
  );

  return { handleItemClick };
}
