"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { Product } from "@/types";
import { getOrCreateActiveList, addListItem } from "@/lib/list";
import { log } from "@/lib/utils/logger";
import { ProductDetailModal } from "@/components/list/product-detail-modal";
import { ProductCaptureModal } from "@/components/product-capture/product-capture-modal";
import { TileActionMenu } from "@/components/list/tile-action-menu";

const FLASH_MS = 600;

export interface ShoppingListTileMode {
  checked: boolean;
  onCheck: () => void;
  quantity?: number;
  onDefer?: () => void;
  onBuyElsewhere?: () => void;
  onDelete?: () => void;
}

interface ProductTileProps {
  product: Product;
  shoppingListMode?: ShoppingListTileMode;
  onProductUpdated?: () => void;
}

export function ProductTile({ product, shoppingListMode, onProductUpdated }: ProductTileProps) {
  const t = useTranslations("catalog");
  const [showDetail, setShowDetail] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [adding, setAdding] = useState(false);
  const [flash, setFlash] = useState<"added" | "increased" | null>(null);
  const [quantityOnList, setQuantityOnList] = useState<number>(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAdd = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (adding) return;
      setAdding(true);

      try {
        const list = await getOrCreateActiveList();
        const result = await addListItem({
          list_id: list.list_id,
          product_id: product.product_id,
          custom_name: null,
          display_name: product.name,
          demand_group_code: product.demand_group_code,
          quantity: 1,
        });

        const newQty = result.quantity;
        setQuantityOnList(newQty);
        setFlash(newQty > 1 ? "increased" : "added");

        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS);
      } catch (err) {
        log.error("[CatalogTile] add failed:", err);
      } finally {
        setAdding(false);
      }
    },
    [adding, product],
  );

  const handleCheckClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      shoppingListMode?.onCheck();
    },
    [shoppingListMode],
  );

  const hasImage = !!product.thumbnail_url;
  const isShoppingList = !!shoppingListMode;
  const isChecked = shoppingListMode?.checked ?? false;
  const hasTileActions =
    isShoppingList &&
    (!!shoppingListMode.onDefer || !!shoppingListMode.onBuyElsewhere || !!shoppingListMode.onDelete);

  return (
    <>
      <div className="relative">
        <div className={`group relative z-0 aspect-square overflow-hidden rounded-xl bg-gray-100 shadow-sm transition-all pointer-fine:hover:shadow-md pointer-fine:hover:ring-1 pointer-fine:hover:ring-aldi-blue/20 ${
          isChecked ? "opacity-30 pointer-events-none" : ""
        }`}>
          <button
            className="relative h-full w-full cursor-pointer"
            onClick={() => setShowDetail(true)}
            aria-label={product.name}
          >
            {hasImage ? (
              <Image
                src={product.thumbnail_url!}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 50vw, 200px"
                className="object-contain"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-3 py-4 text-center">
                <span className="line-clamp-3 text-sm font-semibold leading-tight text-gray-700">
                  {product.name}
                </span>
                {product.brand && (
                  <span className="mt-1 text-xs text-gray-400">{product.brand}</span>
                )}
              </div>
            )}
          </button>

          {/* Price badge */}
          {product.price != null && (
            <span className="absolute bottom-2 left-2 z-10 rounded-lg bg-white/90 px-2 py-0.5 text-xs font-bold text-aldi-text shadow-sm backdrop-blur-sm">
              {Number(product.price).toFixed(2).replace(".", ",")} €
            </span>
          )}

          {isShoppingList ? (
            <button
              onClick={handleCheckClick}
              className="absolute bottom-2 right-2 z-10 h-10 w-10 rounded-full border-2 border-aldi-blue bg-white shadow-sm transition-all active:scale-95"
              aria-label={`${product.name} abhaken`}
            />
          ) : (
            <button
              onClick={handleAdd}
              disabled={adding}
              className={`absolute bottom-2 right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition-all ${
                flash
                  ? "scale-110 bg-green-500 text-white"
                  : "bg-[#F37D1E] text-white hover:bg-[#e06d10] active:scale-95"
              }`}
              aria-label={`${product.name} hinzufügen`}
            >
              {flash ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              )}
            </button>
          )}

          {/* Quantity badge */}
          {!isShoppingList && quantityOnList > 0 && !flash && (
            <span className="absolute top-2 right-2 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-aldi-blue px-1.5 text-xs font-bold text-white shadow">
              {quantityOnList}
            </span>
          )}
          {isShoppingList && (shoppingListMode.quantity ?? 0) > 1 && (
            <span className="absolute top-2 right-2 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-aldi-blue px-1.5 text-xs font-bold text-white shadow">
              {shoppingListMode.quantity}
            </span>
          )}
        </div>

        {hasTileActions && (
          <TileActionMenu
            onDefer={shoppingListMode.onDefer}
            onBuyElsewhere={shoppingListMode.onBuyElsewhere}
            onDelete={shoppingListMode.onDelete}
          />
        )}
      </div>

      {showDetail && (
        <ProductDetailModal
          product={product}
          onClose={() => setShowDetail(false)}
          onEdit={() => {
            setShowDetail(false);
            setShowEdit(true);
          }}
        />
      )}

      {showEdit && (
        <ProductCaptureModal
          open={showEdit}
          mode="edit"
          editAldiProduct={product}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); onProductUpdated?.(); }}
        />
      )}
    </>
  );
}
