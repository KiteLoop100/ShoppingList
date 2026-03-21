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
      // #region agent log
      fetch("http://127.0.0.1:7547/ingest/d58e5f1a-49bc-422a-bf52-4fc861b26370", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d15b77" },
        body: JSON.stringify({
          sessionId: "d15b77",
          location: "use-inventory-item-click.ts:handleItemClick:entry",
          message: "inventory product name tap",
          data: { productId: item.product_id ?? null, competitorProductId: item.competitor_product_id ?? null },
          timestamp: Date.now(),
          hypothesisId: "H1",
          runId: "post-fix",
        }),
      }).catch(() => {});
      // #endregion
      if (item.product_id) {
        const found = findAldiProductForInventoryItem(item, products);
        // #region agent log
        fetch("http://127.0.0.1:7547/ingest/d58e5f1a-49bc-422a-bf52-4fc861b26370", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d15b77" },
          body: JSON.stringify({
            sessionId: "d15b77",
            location: "use-inventory-item-click.ts:handleItemClick:aldi",
            message: "aldi lookup branch",
            data: { found: !!found, opensModal: found ? "ProductDetailModal" : "none" },
            timestamp: Date.now(),
            hypothesisId: "H2",
            runId: "post-fix",
          }),
        }).catch(() => {});
        // #endregion
        if (found) {
          setDetailProduct(found);
          return;
        }
      }
      if (item.competitor_product_id) {
        const found = await findCompetitorProductById(item.competitor_product_id);
        // #region agent log
        fetch("http://127.0.0.1:7547/ingest/d58e5f1a-49bc-422a-bf52-4fc861b26370", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d15b77" },
          body: JSON.stringify({
            sessionId: "d15b77",
            location: "use-inventory-item-click.ts:handleItemClick:competitor",
            message: "competitor lookup branch",
            data: { found: !!found, opensModal: found ? "CompetitorProductDetailModal" : "none" },
            timestamp: Date.now(),
            hypothesisId: "H3",
            runId: "post-fix",
          }),
        }).catch(() => {});
        // #endregion
        if (found) {
          setDetailCompetitor(found);
        }
      }
    },
    [products, setDetailProduct, setDetailCompetitor],
  );

  return { handleItemClick };
}
